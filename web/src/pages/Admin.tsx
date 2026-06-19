// 관리 - 사용량 집계(TRANSPARENCY) + 승인 큐
import { useEffect, useState } from 'react'
import { Button, Card, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { apiGet, apiPost } from '../lib/api'

interface Summary {
  events: number
  prompt_tokens: number
  completion_tokens: number
  tokens_saved: number
}
interface Approval {
  id: string
  resource_type: string
  status: string
}

export default function AdminPage() {
  const [sum, setSum] = useState<Summary | null>(null)
  const [approvals, setApprovals] = useState<Approval[]>([])

  async function load() {
    setSum(await apiGet<Summary>('/governance/v1/usage/summary'))
    setApprovals(await apiGet<Approval[]>('/governance/v1/approvals'))
  }
  useEffect(() => { load() }, [])

  async function decide(id: string, decision: 'approved' | 'rejected') {
    await apiPost(`/governance/v1/approvals/${id}/decide`, { decision })
    load()
  }

  return (
    <Stack>
      <Title order={3}>Admin · Usage</Title>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Stat label="Events" value={sum?.events} />
        <Stat label="Prompt tokens" value={sum?.prompt_tokens} />
        <Stat label="Completion tokens" value={sum?.completion_tokens} />
        <Stat label="Tokens saved (Headroom)" value={sum?.tokens_saved} />
      </SimpleGrid>

      <Title order={4} mt="md">Approval Queue</Title>
      <Table withTableBorder>
        <Table.Thead>
          <Table.Tr><Table.Th>Resource</Table.Th><Table.Th>Status</Table.Th><Table.Th w={200}>Decision</Table.Th></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {approvals.map((a) => (
            <Table.Tr key={a.id}>
              <Table.Td>{a.resource_type}</Table.Td>
              <Table.Td>{a.status}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Button size="xs" color="green" onClick={() => decide(a.id, 'approved')}>승인</Button>
                  <Button size="xs" color="red" variant="light" onClick={() => decide(a.id, 'rejected')}>거부</Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {approvals.length === 0 && (
            <Table.Tr><Table.Td colSpan={3}><Text c="dimmed" ta="center">대기 중인 승인 없음</Text></Table.Td></Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <Card withBorder>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fw={700} size="xl">{value ?? '—'}</Text>
    </Card>
  )
}
