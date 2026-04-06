import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types';

export function LoginPage() {
  const [email, setEmail] = useState('admin@forgenta.io');
  const [password, setPassword] = useState('demo');
  const [role, setRole] = useState<UserRole>('admin');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleLogin = async (_provider?: string) => {
    setLoading(true);
    // Mock login — in production this calls the real auth API
    await new Promise((r) => setTimeout(r, 600));
    login('mock-jwt-token', {
      id: 'usr-001',
      email,
      name: email.split('@')[0],
      status: 'active',
      role,
      workspace_id: 'ws-001',
      workspace_name: 'Forgenta Demo',
    });
    setLoading(false);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50">
      <div className="w-full max-w-md px-6">
        {/* Logo & branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand rounded-2xl mb-4 shadow-lg shadow-brand/20">
            <span className="text-white text-2xl font-bold">F</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Forgenta</h1>
          <p className="text-sm text-text-secondary mt-1">
            Hybrid Agentic AI &mdash; App Platform
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-black/5 border border-border p-8">
          {/* Social login buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleLogin('google')}
              disabled={loading}
              className="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-border rounded-xl text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={() => handleLogin('microsoft')}
              disabled={loading}
              className="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-border rounded-xl text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#F25022" d="M1 1h10v10H1z" />
                <path fill="#00A4EF" d="M1 13h10v10H1z" />
                <path fill="#7FBA00" d="M13 1h10v10H13z" />
                <path fill="#FFB900" d="M13 13h10v10H13z" />
              </svg>
              Continue with Microsoft
            </button>

            <button
              onClick={() => handleLogin('sso')}
              disabled={loading}
              className="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-border rounded-xl text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors"
            >
              <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              Enterprise SSO
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-muted">or sign in with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin('email');
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                placeholder="••••••••"
              />
            </div>
            {/* Role selector for demo */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Demo Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              >
                <option value="admin">Admin</option>
                <option value="power_user">Power User</option>
                <option value="user">User</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-text-muted mt-6">
          Terms of Service &middot; Privacy Policy &middot; Security
        </p>
      </div>
    </div>
  );
}
