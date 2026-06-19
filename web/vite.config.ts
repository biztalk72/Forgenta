import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 개발 시 /api 요청을 게이트웨이(port-forward localhost:8000)로 프록시
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
