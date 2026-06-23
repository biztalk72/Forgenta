// 라우팅 - 로그인 + 보호된 대시보드/카탈로그/관리 레이아웃
import { Navigate, Route, Routes } from 'react-router-dom'
import { isAuthed } from './stores/auth'
import Layout from './components/Layout'
import LoginPage from './pages/Login'
import DashboardPage from './pages/Dashboard'
import CatalogPage from './pages/Catalog'
import AdminPage from './pages/Admin'
import WorkflowsPage from './pages/Workflows'
import RunDetailPage from './pages/RunDetail'

function Protected({ children }: { children: React.ReactNode }) {
  return isAuthed() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/runs/:runId" element={<RunDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
