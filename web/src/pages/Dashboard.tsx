// 대시보드 - 멀티턴 채팅(STREAM-FIRST). 선택된 Agent의 시스템 프롬프트/라우팅 적용 + 자동 스크롤
import { useEffect, useRef, useState } from 'react'
import { Badge, Box, Button, Checkbox, Group, ScrollArea, Stack, Textarea, Title } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import { streamChat, type ChatTurn } from '../lib/stream'
import { apiGet } from '../lib/api'
import ChatMessage, { type ChatMsg } from '../components/ChatMessage'

interface SelectedAgent {
  id: string
  name: string
  systemPrompt?: string
  routing?: Record<string, unknown>
}

interface AgentResponse {
  id: string
  name: string
  config?: { system_prompt?: string; routing?: Record<string, unknown> }
}

export default function DashboardPage() {
  const [params] = useSearchParams()
  const agentId = params.get('agent')
  const [agent, setAgent] = useState<SelectedAgent | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [prompt, setPrompt] = useState('')
  const [highQuality, setHighQuality] = useState(false)
  const [sensitive, setSensitive] = useState(false)
  const [busy, setBusy] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)

  // 선택된 Agent 로드 → 대화 초기화
  useEffect(() => {
    setMessages([])
    if (!agentId) { setAgent(null); return }
    apiGet<AgentResponse>(`/catalog/v1/agents/${agentId}`)
      .then((a) =>
        setAgent({ id: a.id, name: a.name, systemPrompt: a.config?.system_prompt, routing: a.config?.routing }),
      )
      .catch(() => setAgent(null))
  }, [agentId])

  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function run() {
    const text = prompt.trim()
    if (!text || busy) return
    setBusy(true)
    setPrompt('')

    const history: ChatMsg[] = [...messages, { role: 'user', content: text }]
    setMessages([...history, { role: 'assistant', content: '', meta: { running: true, chain: [], fallbacks: [] } }])

    // 시스템 프롬프트(Agent) → 히스토리 순으로 전송 (시스템 메시지는 화면 버블에는 표시하지 않음)
    const turns: ChatTurn[] = []
    if (agent?.systemPrompt) turns.push({ role: 'system', content: agent.systemPrompt })
    turns.push(...history.map((m) => ({ role: m.role, content: m.content })))

    const routing: Record<string, unknown> = { ...(agent?.routing ?? {}) }
    if (highQuality) routing.quality = 'high'
    if (sensitive) routing.sensitive = true

    try {
      for await (const ev of streamChat(turns, routing, agent?.id)) {
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
      <Group justify="space-between" mb="sm">
        <Title order={3}>Dashboard</Title>
        {agent && (
          <Group gap="xs">
            <Badge size="lg" variant="light" color="grape">Agent: {agent.name}</Badge>
            <Button size="xs" variant="subtle" component="a" href="/">일반 채팅</Button>
          </Group>
        )}
      </Group>
      <ScrollArea flex={1} viewportRef={viewport} type="auto">
        <Stack gap="sm" pr="md">
          {messages.length === 0 && (
            <ChatMessage
              msg={{
                role: 'assistant',
                content: agent
                  ? `${agent.name}와 대화를 시작합니다.${agent.systemPrompt ? ' (시스템 프롬프트 적용됨)' : ''}`
                  : '무엇이든 물어보세요. 대화는 멀티턴으로 이어집니다.',
              }}
            />
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
