// Workflows - 워크플로우 목록/검색 + NL 컴파일(SSE) → 저장. Phase 14: /runs/:id 로 진입.
// DESIGN.md §3.5 Mantine 매핑: semantic color, motion 150~320ms(loading), touch ≥44, reduced-motion 존중(애니메이션 미사용).
import { Fragment, useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPost } from '../lib/api'
import { streamSse } from '../lib/stream'

interface Workflow {
  id: string
  name: string
  description: string
  status: string
  version: number
  source: string
}

interface CompiledStep {
  seq: number
  kind: string
  name: string
}

interface WorkflowRun {
  id: string
  status: string
  trigger: string
  summary: string
  started_at?: string
  finished_at?: string | null
}

export default function WorkflowsPage() {
  const nav = useNavigate()
  const [items, setItems] = useState<Workflow[]>([])
  const [q, setQ] = useState('')
  const [description, setDescription] = useState('')
  const [name, setName] = useState('')
  const [steps, setSteps] = useState<CompiledStep[]>([])
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null)
  const [valid, setValid] = useState<boolean | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [runs, setRuns] = useState<Record<string, WorkflowRun[]>>({})

  async function load() {
    try {
      setItems(await apiGet<Workflow[]>('/workflow/v1/workflows'))
    } catch {
      setItems([])
    }
  }
  useEffect(() => {
    load()
  }, [])

  async function compile() {
    if (!description.trim() || compiling) return
    setCompiling(true)
    setSteps([])
    setSpec(null)
    setValid(null)
    try {
      for await (const ev of streamSse('/api/orchestration/v1/workflows/compile', {
        description: description.trim(),
        routing: {},
      })) {
        if (ev.event === 'step') {
          const s = ev.data as unknown as CompiledStep
          setSteps((cur) => [...cur, s])
        } else if (ev.event === 'done') {
          setSpec((ev.data.spec as Record<string, unknown>) ?? null)
          setValid(Boolean(ev.data.valid))
        }
      }
    } catch {
      setValid(false)
    } finally {
      setCompiling(false)
    }
  }

  async function save() {
    if (!name.trim() || !spec || saving) return
    setSaving(true)
    try {
      await apiPost('/workflow/v1/workflows', {
        name: name.trim(),
        description: description.trim(),
        spec,
        source: 'nl',
      })
      setName('')
      setDescription('')
      setSpec(null)
      setSteps([])
      setValid(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function toggleRuns(wfId: string) {
    if (runs[wfId]) {
      setRuns((cur) => {
        const copy = { ...cur }
        delete copy[wfId]
        return copy
      })
      return
    }
    try {
      const r = await apiGet<WorkflowRun[]>(`/workflow/v1/workflows/${wfId}/runs`)
      setRuns((cur) => ({ ...cur, [wfId]: r }))
    } catch {
      setRuns((cur) => ({ ...cur, [wfId]: [] }))
    }
  }

  async function startRun(wfId: string) {
    // 디태치드 컨슈머 — 라우팅 후에도 백그라운드에서 SSE 를 끝까지 흡수해 서버측 runtime 이
    // 다음 단계까지 진행하도록 한다 (early abort 시 step 들이 미실행). run_id 받자마자 navigate.
    let navigated = false
    void (async () => {
      try {
        for await (const ev of streamSse(
          `/api/orchestration/v1/workflows/${wfId}/run`,
          { routing: {}, initial_context: {} },
        )) {
          if (!navigated && ev.event === 'run.started' && typeof ev.data.run_id === 'string') {
            navigated = true
            nav(`/runs/${ev.data.run_id}`)
          }
        }
      } catch {
        // ignore — /runs 페이지가 폴링으로 상태를 보여준다.
      }
    })()
  }

  async function remove(id: string) {
    await apiDelete(`/workflow/v1/workflows/${id}`)
    load()
  }

  const filtered = items.filter((w) => w.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <Stack>
      <Title order={3}>Workflows</Title>
      <Card withBorder>
        <Stack>
          <Text fw={500}>NL 설명 → 컴파일</Text>
          <Textarea
            placeholder="예: '매주 월요일 매출 리포트를 요약해서 매니저 승인 후 슬랙에 게시'"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={6}
          />
          <Group>
            <Button onClick={compile} loading={compiling} disabled={!description.trim()}>
              컴파일
            </Button>
            {valid !== null && (
              <Badge color={valid ? 'green' : 'red'} variant="light">
                {valid ? `valid (${steps.length} steps)` : 'invalid spec'}
              </Badge>
            )}
          </Group>
          {steps.length > 0 && (
            <Stack gap={4}>
              {steps.map((s) => (
                <Text key={s.seq} size="sm">
                  <Badge size="xs" variant="outline" mr="xs">
                    {s.seq}
                  </Badge>
                  <Badge size="xs" mr="xs">
                    {s.kind}
                  </Badge>
                  {s.name}
                </Text>
              ))}
            </Stack>
          )}
          {spec && valid && (
            <Group>
              <TextInput
                placeholder="워크플로우 이름"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                w={260}
              />
              <Button onClick={save} loading={saving} disabled={!name.trim()}>
                저장
              </Button>
            </Group>
          )}
        </Stack>
      </Card>

      <TextInput
        placeholder="저장된 워크플로우 검색"
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
      />

      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Source</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Version</Table.Th>
            <Table.Th w={280}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filtered.map((w) => (
            <Fragment key={w.id}>
              <Table.Tr>
                <Table.Td>{w.name}</Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light">
                    {w.source}
                  </Badge>
                </Table.Td>
                <Table.Td>{w.status}</Table.Td>
                <Table.Td>v{w.version}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button size="xs" onClick={() => startRun(w.id)}>
                      실행
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => toggleRuns(w.id)}
                    >
                      {runs[w.id] ? '닫기' : 'Runs'}
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      onClick={() => remove(w.id)}
                    >
                      삭제
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
              {runs[w.id] !== undefined && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    {runs[w.id].length === 0 ? (
                      <Text c="dimmed" size="sm">
                        아직 실행 기록 없음
                      </Text>
                    ) : (
                      <Stack gap={4}>
                        {runs[w.id].map((r) => (
                          <Group key={r.id} gap="sm">
                            <Badge
                              size="xs"
                              color={statusColor(r.status)}
                              variant="light"
                            >
                              {r.status}
                            </Badge>
                            <Text size="sm" style={{ fontFamily: 'monospace' }}>
                              {r.id.slice(0, 8)}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {r.trigger} · {r.started_at?.slice(0, 19) ?? ''}
                            </Text>
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              onClick={() => nav(`/runs/${r.id}`)}
                            >
                              보기
                            </Button>
                          </Group>
                        ))}
                      </Stack>
                    )}
                  </Table.Td>
                </Table.Tr>
              )}
            </Fragment>
          ))}
          {filtered.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text c="dimmed" ta="center">
                  결과 없음 — 위에서 새 워크플로우를 컴파일하세요.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

function statusColor(status: string): string {
  if (status === 'succeeded') return 'green'
  if (status === 'failed' || status === 'cancelled') return 'red'
  if (status === 'awaiting_approval') return 'yellow'
  return 'blue'
}
