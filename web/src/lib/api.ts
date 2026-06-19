// 게이트웨이 REST 클라이언트 - Authorization 헤더 자동 첨부
import { getToken } from '../stores/auth'

const BASE = '/api'

function headers(json = true): Record<string, string> {
  const h: Record<string, string> = {}
  if (json) h['Content-Type'] = 'application/json'
  const t = getToken()
  if (t) h['Authorization'] = `Bearer ${t}`
  return h
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: headers(false) })
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`)
  return r.json() as Promise<T>
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}`)
  return r.json() as Promise<T>
}

export async function apiDelete(path: string): Promise<void> {
  const r = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers(false) })
  if (!r.ok) throw new Error(`DELETE ${path} → ${r.status}`)
}

export async function login(email: string, password: string): Promise<string> {
  const r = await fetch(`${BASE}/identity/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!r.ok) throw new Error('invalid credentials')
  const d = (await r.json()) as { access_token: string }
  return d.access_token
}
