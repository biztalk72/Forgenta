// 로그인 페이지 - 이메일/비밀번호 → JWT 발급 후 대시보드 이동
import { useState } from 'react'
import { Button, Card, Center, PasswordInput, Stack, TextInput, Title, Text } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { login } from '../lib/api'
import { setToken } from '../stores/auth'

export default function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('admin@forgenta.local')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    setErr('')
    try {
      setToken(await login(email, password))
      nav('/')
    } catch {
      setErr('로그인 실패. 이메일/비밀번호를 확인하세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Center h="100vh">
      <Card withBorder shadow="sm" w={360} p="lg">
        <Stack>
          <Title order={3}>Forgenta 로그인</Title>
          <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          {err && <Text c="red" size="sm">{err}</Text>}
          <Button onClick={submit} loading={loading}>로그인</Button>
        </Stack>
      </Card>
    </Center>
  )
}
