// 앱 진입점 - MantineProvider + Router 부트스트랩
import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { BrowserRouter } from 'react-router-dom'
import '@mantine/core/styles.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>,
)
