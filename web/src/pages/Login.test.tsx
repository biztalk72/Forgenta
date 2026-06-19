// Login 페이지 스모크 테스트 - 렌더 + 입력 필드 존재 확인
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './Login'

function setup() {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </MantineProvider>,
  )
}

test('renders login form with email, password and submit', () => {
  setup()
  expect(screen.getByText('Forgenta 로그인')).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toBeInTheDocument()
  expect(screen.getByLabelText('Password')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
})
