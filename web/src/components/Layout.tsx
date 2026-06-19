// 공통 레이아웃 - AppShell(네비 + 헤더 + 로그아웃)
import { AppShell, Group, NavLink, Title, Button } from '@mantine/core'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearToken } from '../stores/auth'

const NAV = [
  { label: 'Dashboard', to: '/' },
  { label: 'Catalog', to: '/catalog' },
  { label: 'Admin', to: '/admin' },
]

export default function Layout() {
  const nav = useNavigate()
  const loc = useLocation()
  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 200, breakpoint: 'sm' }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>Forgenta</Title>
          <Button variant="subtle" size="xs" onClick={() => { clearToken(); nav('/login') }}>
            Logout
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            label={n.label}
            active={loc.pathname === n.to}
            onClick={() => nav(n.to)}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
