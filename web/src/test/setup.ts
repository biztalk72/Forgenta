// vitest 셋업 - jest-dom 매처 + jsdom에 없는 브라우저 API 폴리필(Mantine 요구)
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver as unknown as typeof window.ResizeObserver
