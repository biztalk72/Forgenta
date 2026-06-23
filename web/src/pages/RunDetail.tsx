// RunDetail (Phase 14) - 단일 workflow_run 의 단계 타임라인 + 승인 결정/재개.
// 폴링(1.5s)으로 state 동기화. awaiting_approval 단계가 있으면 approve/reject → resume SSE.
// DESIGN.md §3.5 Mantine 매핑: semantic color, ≥44px touch, motion 150~320ms (Mantine 기본).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Button, Card, Code, Group, Stack, Text, Title } from '@mantine/core'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPost } from '../lib/api'
import { streamSse } from '../lib/stream'

interface StepRun {
  id: string
  step_seq: number
  kind: string
  status: string
  error: string
  approval_id: string
  prompt_tokens: number
  completion_tokens: number
  latency_ms: number
}

interface RunState {
  id: string
  workflow_id: string
  status: string
  trigger: string
  summary: string
  context: Record<string, unknown> | null
  steps: StepRun[]
}

export default function RunDetailPage() {
  const { runId = '' } = useParams<{ runId: string }>()
  const nav = useNavigate()
  const [run, setRun] = useState<RunState | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [resumeLog, setResumeLog] = useState<string[]>([])
  const pollTimer = useRef<number | null>(null)

  const fetchRun = useCallback(async () => {
    try {
      const r = await apiGet<RunState>(`/workflow/v1/runs/${runId}`)
      setRun(r)
      setErr(null)
    } catch (e) {
      setErr(String(e))
    }
  }, [runId])

  useEffect(() => {
    if (!runId) return
    fetchRun()
    // 단순 폴링 (live SSE 는 resume 시에만; 일반 run 은 Workflows 페이지의 detached consumer 가 진행 중).
    pollTimer.current = window.setInterval(fetchRun, 1500)
    return () => {
      if (pollTimer.current !== null) {
        window.clearInterval(pollTimer.current)
        pollTimer.current = null
      }
    }
  }, [runId, fetchRun])

  // 종료 상태에서는 폴링 중단 (succeeded/failed/cancelled).
  useEffect(() => {
    if (run && pollTimer.current !== null) {
      if (['succeeded', 'failed', 'cancelled'].includes(run.status)) {
        window.clearInterval(pollTimer.current)
        pollTimer.current = null
      }
    }
  }, [run])

  const awaitingStep = run?.steps.find((s) => s.status === 'awaiting_approval')

  async function decide(decision: 'approved' | 'rejected') {
    if (!awaitingStep || !awaitingStep.approval_id || deciding) return
    setDeciding(true)
    try {
      await apiPost(`/governance/v1/approvals/${awaitingStep.approval_id}/decide`, { decision })
      // 결정 후 자동으로 resume 호출 — UX 한 번에.
      await resume()
    } catch (e) {
      setErr(String(e))
    } finally {
      setDeciding(false)
    }
  }

  async function resume() {
    if (resuming) return
    setResuming(true)
    setResumeLog([])
    try {
      for await (const ev of streamSse(
        `/api/orchestration/v1/workflows/runs/${runId}/resume`,
        { routing: {} },
      )) {
        setResumeLog((cur) => [...cur, `${ev.event}: ${JSON.stringify(ev.data)}`])
      }
      await fetchRun()
    } catch (e) {
      setErr(String(e))
    } finally {
      setResuming(false)
    }
  }

  if (!runId) return <Text c="dimmed">no run id</Text>
  if (err && !run) return <Text c="red">{err}</Text>
  if (!run) return <Text c="dimmed">로딩...</Text>

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Run · {run.id.slice(0, 8)}</Title>
        <Group gap="sm">
          <Badge color={statusColor(run.status)} variant="light" size="lg">
            {run.status}
          </Badge>
          <Button variant="subtle" size="xs" onClick={() => nav('/workflows')}>
            ← Workflows
          </Button>
        </Group>
      </Group>

      <Card withBorder>
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Trigger: {run.trigger} · Workflow: <Code>{run.workflow_id.slice(0, 8)}</Code>
          </Text>
          {run.summary && <Text size="sm">{run.summary}</Text>}
        </Stack>
      </Card>

      <Title order={5}>Steps</Title>
      <Stack gap="xs">
        {run.steps.map((s) => (
          <Card key={s.id || s.step_seq} withBorder p="sm">
            <Group justify="space-between">
              <Group gap="sm">
                <Badge size="sm" variant="outline">
                  #{s.step_seq}
                </Badge>
                <Badge size="sm">{s.kind}</Badge>
                <Badge size="sm" color={statusColor(s.status)} variant="light">
                  {s.status}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                {s.completion_tokens} tok · {s.latency_ms} ms
              </Text>
            </Group>
            {s.error && (
              <Text size="xs" c="red" mt={4}>
                {s.error}
              </Text>
            )}
          </Card>
        ))}
        {run.steps.length === 0 && (
          <Text c="dimmed" size="sm">
            아직 실행된 step 이 없습니다.
          </Text>
        )}
      </Stack>

      {awaitingStep && (
        <Card withBorder bg="var(--mantine-color-yellow-light)">
          <Stack gap="xs">
            <Text fw={500}>승인 대기 — Step #{awaitingStep.step_seq}</Text>
            <Text size="sm" c="dimmed">
              approval_id: <Code>{awaitingStep.approval_id || '(none)'}</Code>
            </Text>
            <Group>
              <Button
                color="green"
                onClick={() => decide('approved')}
                loading={deciding}
                disabled={!awaitingStep.approval_id || resuming}
              >
                승인 & 재개
              </Button>
              <Button
                color="red"
                variant="light"
                onClick={() => decide('rejected')}
                loading={deciding}
                disabled={!awaitingStep.approval_id || resuming}
              >
                거부 & 중단
              </Button>
              <Button
                variant="subtle"
                onClick={resume}
                loading={resuming}
                disabled={!awaitingStep.approval_id || deciding}
                title="결정만 변경하고 직접 resume 트리거"
              >
                Resume 만
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {resumeLog.length > 0 && (
        <Card withBorder>
          <Stack gap={4}>
            <Text fw={500} size="sm">
              Resume 스트림
            </Text>
            {resumeLog.map((line, i) => (
              <Code key={i} block style={{ fontSize: 11 }}>
                {line}
              </Code>
            ))}
          </Stack>
        </Card>
      )}

      {run.context && Object.keys(run.context).length > 0 && (
        <Card withBorder>
          <Stack gap={4}>
            <Text fw={500} size="sm">
              Context (blackboard)
            </Text>
            <Code block>{JSON.stringify(run.context, null, 2)}</Code>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}

function statusColor(status: string): string {
  if (status === 'succeeded') return 'green'
  if (status === 'failed' || status === 'cancelled') return 'red'
  if (status === 'awaiting_approval') return 'yellow'
  if (status === 'running') return 'blue'
  return 'gray'
}
