// 채팅 메시지 버블 - user/assistant + assistant 투명성 메타(model/chain/tokens/fallback)
import { Badge, Group, Loader, Paper, Stack, Text } from '@mantine/core'

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  meta?: {
    chain?: string[]
    model?: string | null
    tokens?: number
    latencyMs?: number
    fallbacks?: string[]
    running?: boolean
  }
}

export default function ChatMessage({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === 'user'
  return (
    <Group justify={isUser ? 'flex-end' : 'flex-start'} align="flex-start" wrap="nowrap">
      <Paper
        withBorder
        p="sm"
        maw="80%"
        bg={isUser ? 'var(--mantine-color-blue-light)' : undefined}
      >
        <Stack gap={6}>
          <Text size="xs" c="dimmed">{isUser ? 'You' : 'Forgenta'}</Text>
          <Text style={{ whiteSpace: 'pre-wrap' }}>
            {msg.content}
            {msg.meta?.running && !msg.content && <Loader size="xs" />}
          </Text>
          {!isUser && msg.meta && (
            <Group gap={6}>
              {msg.meta.running && <Badge color="yellow" size="sm">streaming</Badge>}
              {msg.meta.model && <Badge variant="light" size="sm">{msg.meta.model}</Badge>}
              {msg.meta.fallbacks?.map((f) => (
                <Badge key={f} variant="light" color="orange" size="sm">fallback: {f}</Badge>
              ))}
              {!msg.meta.running && msg.meta.model && (
                <Badge variant="light" color="blue" size="sm">
                  {msg.meta.tokens ?? 0} tok · {msg.meta.latencyMs ?? 0} ms
                </Badge>
              )}
            </Group>
          )}
        </Stack>
      </Paper>
    </Group>
  )
}
