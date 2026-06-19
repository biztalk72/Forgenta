// 카탈로그 - Agent 검색(SEARCH-BEFORE-BUILD)/생성(시스템 프롬프트)/Chat/Clone/삭제
import { useEffect, useState } from 'react'
import { ActionIcon, Button, Card, Group, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPost } from '../lib/api'

interface Agent {
  id: string
  name: string
  description: string
}

export default function CatalogPage() {
  const nav = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')

  async function load() {
    setAgents(await apiGet<Agent[]>('/catalog/v1/agents'))
  }
  useEffect(() => { load() }, [])

  async function create() {
    if (!name.trim()) return
    const config = systemPrompt.trim() ? { system_prompt: systemPrompt.trim() } : {}
    await apiPost('/catalog/v1/agents', { name, config })
    setName('')
    setSystemPrompt('')
    load()
  }
  async function clone(id: string) {
    await apiPost(`/catalog/v1/agents/${id}/clone`)
    load()
  }
  async function remove(id: string) {
    await apiDelete(`/catalog/v1/agents/${id}`)
    load()
  }

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <Stack>
      <Title order={3}>Catalog</Title>
      <Card withBorder>
        <Stack>
          <TextInput placeholder="새 만들기 전에 검색" value={q} onChange={(e) => setQ(e.currentTarget.value)} />
          <Group align="flex-end">
            <TextInput label="새 Agent 이름" value={name} onChange={(e) => setName(e.currentTarget.value)} w={200} />
            <TextInput
              label="시스템 프롬프트 (선택)"
              placeholder="예: 너는 해적처럼 말한다"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.currentTarget.value)}
              flex={1}
            />
            <Button onClick={create}>생성</Button>
          </Group>
        </Stack>
      </Card>
      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr><Table.Th>Name</Table.Th><Table.Th>Description</Table.Th><Table.Th w={220}>Actions</Table.Th></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filtered.map((a) => (
            <Table.Tr key={a.id}>
              <Table.Td>{a.name}</Table.Td>
              <Table.Td><Text c="dimmed" size="sm">{a.description}</Text></Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Button size="xs" variant="light" onClick={() => nav(`/?agent=${a.id}`)}>Chat</Button>
                  <ActionIcon variant="light" onClick={() => clone(a.id)} title="Clone">⎘</ActionIcon>
                  <ActionIcon variant="light" color="red" onClick={() => remove(a.id)} title="Delete">✕</ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {filtered.length === 0 && (
            <Table.Tr><Table.Td colSpan={3}><Text c="dimmed" ta="center">결과 없음 — 새로 만들 수 있습니다.</Text></Table.Td></Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}
