import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CatalogPage } from '@/pages/CatalogPage';
import { BuilderPage } from '@/pages/BuilderPage';
import { AdminPage } from '@/pages/AdminPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/catalog/:type" element={<CatalogPage />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/datasets" element={<div className="p-6"><h1 className="text-lg font-semibold text-text-primary">Datasets</h1><p className="text-sm text-text-muted mt-2">Dataset management coming soon.</p></div>} />
          <Route path="/recent" element={<div className="p-6"><h1 className="text-lg font-semibold text-text-primary">Recent</h1><p className="text-sm text-text-muted mt-2">Recently used items will appear here.</p></div>} />
          <Route path="/favorites" element={<div className="p-6"><h1 className="text-lg font-semibold text-text-primary">Favorites</h1><p className="text-sm text-text-muted mt-2">Your favorite items will appear here.</p></div>} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
