// 대시보드 - 프롬프트 입력 → 스트리밍 결과(STREAM-FIRST) + 라우팅 옵션(PROGRESSIVE DISCLOSURE)
import { useState } from 'react'
import { Button, Checkbox, Grid, Group, Stack, Textarea, Title } from '@mantine/core'
import { streamChat } from '../lib/stream'
import OutputPanel, { type RunState } from '../components/OutputPanel'

const EMPTY: RunState = {
  text: '', events: [], chain: [], model: null, completionTokens: 0, latencyMs: 0, running: false,
}

export default function DashboardPage() {
  const [prompt, setPrompt] = useState('Forgenta가 무엇인지 한 문장으로 설명해줘. /no_think')
  const [highQuality, setHighQuality] = useState(false)
  const [sensitive, setSensitive] = useState(false)
  const [state, setState] = useState<RunState>(EMPTY)

  async function run() {
    setState({ ...EMPTY, running: true })
    const routing: Record<string, unknown> = {}
    if (highQuality) routing.quality = 'high'
    if (sensitive) routing.sensitive = true
    try {
      for await (const ev of streamChat(prompt, routing)) {
        setState((s) => reduce(s, ev))
      }
    } catch {
      setState((s) => ({ ...s, running: false }))
    }
  }

  return (
    <Stack>
      <Title order={3}>Dashboard</Title>
      <Grid>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack>
            <Textarea
              label="Prompt"
              autosize
              minRows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
            />
            <Group>
              <Checkbox label="고품질" checked={highQuality} onChange={(e) => setHighQuality(e.currentTarget.checked)} />
              <Checkbox label="민감 데이터" checked={sensitive} onChange={(e) => setSensitive(e.currentTarget.checked)} />
            </Group>
            <Button onClick={run} loading={state.running}>실행</Button>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <OutputPanel state={state} />
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

function reduce(s: RunState, ev: { event: string; data: Record<string, unknown> }): RunState {
  switch (ev.event) {
    case 'meta':
      return { ...s, chain: (ev.data.chain as string[]) ?? [], events: [...s.events, ev] }
    case 'token':
      return { ...s, text: s.text + (ev.data.text as string), events: [...s.events, ev] }
    case 'fallback':
      return { ...s, events: [...s.events, ev] }
    case 'done':
      return {
        ...s,
        running: false,
        model: (ev.data.model as string) ?? null,
        completionTokens: (ev.data.completion_tokens as number) ?? 0,
        latencyMs: (ev.data.latency_ms as number) ?? 0,
        events: [...s.events, ev],
      }
    default:
      return s
  }
}
