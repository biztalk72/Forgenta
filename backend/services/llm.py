"""Ollama LLM service for Forgenta."""

import asyncio
import json
import ollama
from typing import AsyncGenerator

MODEL = "qwen3:latest"


SYSTEM_PROMPT = """당신은 Forgenta 하이브리드 에이전틱 AI 플랫폼의 어시스턴트입니다.
사내 제조, HR, 재무 데이터를 기반으로 질문에 답변합니다.

규칙:
1. 제공된 컨텍스트 데이터를 기반으로 정확하게 답변하세요.
2. 데이터에 수치가 포함된 경우, JSON 형식의 구조화된 데이터를 응답 끝에 포함하세요.
3. 구조화된 데이터가 있을 때는 반드시 아래 형식으로 응답 끝에 추가하세요:

```json:chart
{
  "type": "bar|line|pie",
  "title": "차트 제목",
  "labels": ["라벨1", "라벨2"],
  "datasets": [{"label": "데이터셋명", "data": [값1, 값2]}]
}
```

```json:table
{
  "headers": ["컬럼1", "컬럼2"],
  "rows": [["값1", "값2"], ["값3", "값4"]]
}
```

4. 컨텍스트에 없는 내용은 "제공된 데이터에서 해당 정보를 찾을 수 없습니다"라고 답하세요.
5. 한국어로 답변하세요. /no_think"""


def build_prompt_with_context(user_message: str, context_docs: list[dict]) -> list[dict]:
    """Build chat messages with RAG context."""
    context_text = ""
    if context_docs:
        context_text = "\n\n--- 관련 데이터 ---\n"
        for doc in context_docs:
            context_text += f"\n[{doc.get('title', '')}]\n{doc.get('content', '')}\n"
            if doc.get("data"):
                context_text += f"데이터: {json.dumps(doc['data'], ensure_ascii=False)}\n"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"{context_text}\n\n질문: {user_message}"},
    ]
    return messages


async def chat_stream(messages: list[dict]) -> AsyncGenerator[str, None]:
    """Stream chat response from Ollama without blocking the event loop."""
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    def _run_stream():
        stream = ollama.chat(model=MODEL, messages=messages, stream=True)
        for chunk in stream:
            content = chunk.get("message", {}).get("content", "")
            if content:
                loop.call_soon_threadsafe(queue.put_nowait, content)
        loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

    asyncio.get_event_loop().run_in_executor(None, _run_stream)
    while True:
        token = await queue.get()
        if token is None:
            break
        yield token


def chat_sync(messages: list[dict]) -> str:
    """Synchronous chat for prompt refinement."""
    response = ollama.chat(model=MODEL, messages=messages)
    return response["message"]["content"]


REFINE_PROMPT = """당신은 프롬프트 엔지니어입니다. 사용자의 자유 입력을 분석하여 구조화된 프롬프트로 정제하세요.

규칙:
1. 의도를 명확히 파악하세요.
2. 누락된 조건이 있으면 추가하세요.
3. 출력 형식을 명시하세요.
4. 한국어로 응답하세요.

원본 프롬프트: {original}

아래 형식으로만 응답하세요:
[정제된 프롬프트]
(정제된 프롬프트 내용)

[변경 사항]
- (변경1)
- (변경2) /no_think"""


def refine_prompt(original: str) -> str:
    """Refine a user prompt using LLM."""
    messages = [
        {"role": "user", "content": REFINE_PROMPT.format(original=original)},
    ]
    return chat_sync(messages)
