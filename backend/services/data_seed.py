"""Seed data loader for Forgenta."""

import json
from pathlib import Path
from backend.services.vector import add_documents, add_prompt

DATA_DIR = Path(__file__).parent.parent / "data"

# In-memory store for full documents (with data field for chart/table)
_documents_store: dict[str, dict] = {}


def get_document_by_id(doc_id: str) -> dict | None:
    return _documents_store.get(doc_id)


def get_all_documents() -> list[dict]:
    return list(_documents_store.values())


def load_seed_data():
    """Load all seed JSON files into ChromaDB and memory."""
    all_docs = []
    for filename in ["manufacturing.json", "hr.json", "finance.json"]:
        filepath = DATA_DIR / filename
        if filepath.exists():
            with open(filepath, encoding="utf-8") as f:
                docs = json.load(f)
                all_docs.extend(docs)

    # Store in memory for data field access
    for doc in all_docs:
        _documents_store[doc["id"]] = doc

    # Index in ChromaDB
    add_documents(all_docs)

    # Seed some example prompts
    example_prompts = [
        ("p-001", "CNC 가공 라인별 불량률을 분석해줘"),
        ("p-002", "부서별 인원 현황을 알려줘"),
        ("p-003", "분기별 매출 추이를 차트로 보여줘"),
        ("p-004", "원자재 재고 중 긴급 발주가 필요한 항목은?"),
        ("p-005", "직원 만족도 조사 결과를 분석해줘"),
        ("p-006", "부서별 예산 집행률을 비교해줘"),
        ("p-007", "품질 검사 불합격 원인을 분석해줘"),
        ("p-008", "비용 이상치가 발생한 항목과 원인을 알려줘"),
        ("p-009", "설비 가동률이 가장 높은 월은?"),
        ("p-010", "채용 현황을 월별로 보여줘"),
    ]
    for pid, text in example_prompts:
        add_prompt(pid, text)

    return len(all_docs)
