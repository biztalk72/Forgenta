// SSE-over-fetch 파서 - POST + Authorization 헤더로 스트리밍 (EventSource는 헤더 미지원)
import { getToken } from '../stores/auth'

export interface SseEvent {
  event: string
  data: Record<string, unknown>
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export async function* streamChat(
  messages: ChatTurn[],
  routing: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
  const resp = await fetch('/api/orchestration/v1/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() ?? ''}`,
    },
    body: JSON.stringify({ messages, routing }),
    signal,
  })
  if (!resp.ok || !resp.body) throw new Error(`stream → ${resp.status}`)

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const blocks = buf.split('\n\n')
    buf = blocks.pop() ?? ''
    for (const block of blocks) {
      const ev = parseBlock(block)
      if (ev) yield ev
    }
  }
}

function parseBlock(block: string): SseEvent | null {
  let event = 'message'
  let data = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!data) return null
  try {
    return { event, data: JSON.parse(data) }
  } catch {
    return null
  }
}
