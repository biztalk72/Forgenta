// JWT 토큰을 localStorage에 보관하는 최소 인증 스토어
const KEY = 'forgenta_token'

export function getToken(): string | null {
  return localStorage.getItem(KEY)
}

export function setToken(token: string) {
  localStorage.setItem(KEY, token)
}

export function clearToken() {
  localStorage.removeItem(KEY)
}

export function isAuthed(): boolean {
  return !!getToken()
}
