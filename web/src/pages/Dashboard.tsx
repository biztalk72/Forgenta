// 대시보드 - 멀티턴 채팅(STREAM-FIRST). 스크롤 가능한 대화 + 하단 고정 입력 + 라우팅 옵션
import { useEffect, useRef, useState } from 'react'
import { Box, Button, Checkbox, Group, ScrollArea, Stack, Textarea, Title } from '@mantine/core'
import { streamChat, type ChatTurn } from '../lib/stream'
import ChatMessage, { type ChatMsg } from '../components/ChatMessage'

export default function DashboardPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [prompt, setPrompt] = useState('')
  const [highQuality, setHighQuality] = useState(false)
  const [sensitive, setSensitive] = useState(false)
  const [busy, setBusy] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)

  // 새 토큰/메시지마다 맨 아래로 스크롤
  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function run() {
    const text = prompt.trim()
    if (!text || busy) return
    setBusy(true)
    setPrompt('')

    // 히스토리(이번 사용자 입력 포함)를 백엔드로 전송 → 멀티턴 컨텍스트
    const history: ChatMsg[] = [...messages, { role: 'user', content: text }]
    setMessages([...history, { role: 'assistant', content: '', meta: { running: true, chain: [], fallbacks: [] } }])

    const turns: ChatTurn[] = history.map((m) => ({ role: m.role, content: m.content }))
    const routing: Record<string, unknown> = {}
    if (highQuality) routing.quality = 'high'
    if (sensitive) routing.sensitive = true

    try {
      for await (const ev of streamChat(turns, routing)) {
        setMessages((cur) => apply(cur, ev))
      }
    } catch {
      setMessages((cur) => patchLast(cur, (m) => ({ ...m, meta: { ...m.meta, running: false } })))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 90px)' }}>
      <Title order={3} mb="sm">Dashboard</Title>
      <ScrollArea flex={1} viewportRef={viewport} type="auto">
        <Stack gap="sm" pr="md">
          {messages.length === 0 && (
            <ChatMessage msg={{ role: 'assistant', content: '무엇이든 물어보세요. 대화는 멀티턴으로 이어집니다.' }} />
          )}
          {messages.map((m, i) => <ChatMessage key={i} msg={m} />)}
        </Stack>
      </ScrollArea>
      <Stack gap="xs" mt="sm">
        <Group gap="md">
          <Checkbox label="고품질" checked={highQuality} onChange={(e) => setHighQuality(e.currentTarget.checked)} />
          <Checkbox label="민감 데이터" checked={sensitive} onChange={(e) => setSensitive(e.currentTarget.checked)} />
        </Group>
        <Group align="flex-end" wrap="nowrap">
          <Textarea
            flex={1}
            autosize
            minRows={1}
            maxRows={6}
            placeholder="메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
            value={prompt}
            onChange={(e) => setPrompt(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                run()
              }
            }}
          />
          <Button onClick={run} loading={busy}>전송</Button>
        </Group>
      </Stack>
    </Box>
  )
}

function patchLast(cur: ChatMsg[], fn: (m: ChatMsg) => ChatMsg): ChatMsg[] {
  if (cur.length === 0) return cur
  const copy = cur.slice()
  copy[copy.length - 1] = fn(copy[copy.length - 1])
  return copy
}

function apply(cur: ChatMsg[], ev: { event: string; data: Record<string, unknown> }): ChatMsg[] {
  switch (ev.event) {
    case 'meta':
      return patchLast(cur, (m) => ({ ...m, meta: { ...m.meta, chain: (ev.data.chain as string[]) ?? [] } }))
    case 'token':
      return patchLast(cur, (m) => ({ ...m, content: m.content + (ev.data.text as string) }))
    case 'fallback':
      return patchLast(cur, (m) => ({
        ...m,
        meta: { ...m.meta, fallbacks: [...(m.meta?.fallbacks ?? []), ev.data.model as string] },
      }))
    case 'done':
      return patchLast(cur, (m) => ({
        ...m,
        meta: {
          ...m.meta,
          running: false,
          model: (ev.data.model as string) ?? null,
          tokens: (ev.data.completion_tokens as number) ?? 0,
          latencyMs: (ev.data.latency_ms as number) ?? 0,
        },
      }))
    default:
      return cur
  }
}
