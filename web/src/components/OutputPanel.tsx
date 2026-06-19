// 멀티모달 Output Panel (OUTPUT-CENTRIC) - Text/Raw/Events 탭 + 투명성 상태바
import { Badge, Code, Group, Paper, ScrollArea, Tabs, Text } from '@mantine/core'
import type { SseEvent } from '../lib/stream'

export interface RunState {
  text: string
  events: SseEvent[]
  chain: string[]
  model: string | null
  completionTokens: number
  latencyMs: number
  running: boolean
}

export default function OutputPanel({ state }: { state: RunState }) {
  return (
    <Paper withBorder p="md" mih={360}>
      <Group mb="sm" gap="xs">
        <Badge color={state.running ? 'yellow' : state.model ? 'green' : 'gray'}>
          {state.running ? 'streaming' : state.model ? 'done' : 'idle'}
        </Badge>
        {state.model && <Badge variant="light">model: {state.model}</Badge>}
        {state.chain.length > 0 && <Badge variant="light" color="grape">chain: {state.chain.join(' → ')}</Badge>}
        {!state.running && state.model && (
          <Badge variant="light" color="blue">
            {state.completionTokens} tok · {state.latencyMs} ms
          </Badge>
        )}
      </Group>
      <Tabs defaultValue="text">
        <Tabs.List>
          <Tabs.Tab value="text">Text</Tabs.Tab>
          <Tabs.Tab value="raw">Raw</Tabs.Tab>
          <Tabs.Tab value="events">Events</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="text" pt="sm">
          <Text style={{ whiteSpace: 'pre-wrap' }}>{state.text || '결과가 여기에 스트리밍됩니다.'}</Text>
        </Tabs.Panel>
        <Tabs.Panel value="raw" pt="sm">
          <Code block>{state.text}</Code>
        </Tabs.Panel>
        <Tabs.Panel value="events" pt="sm">
          <ScrollArea h={260}>
            {state.events.map((e, i) => (
              <Code key={i} block mb={4}>{e.event}: {JSON.stringify(e.data)}</Code>
            ))}
          </ScrollArea>
        </Tabs.Panel>
      </Tabs>
    </Paper>
  )
}
