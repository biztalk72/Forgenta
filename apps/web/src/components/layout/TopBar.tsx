import { Search, Bell, ChevronDown, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function TopBar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between h-14 px-4 bg-white border-b border-border shrink-0">
      {/* Search */}
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary rounded-lg border border-border w-full">
          <Search size={16} className="text-text-muted" />
          <input
            type="text"
            placeholder="Search agents, apps, prompts..."
            className="bg-transparent outline-none text-sm text-text-primary flex-1 placeholder:text-text-muted"
          />
          <kbd className="text-xs text-text-muted bg-surface-tertiary px-1.5 py-0.5 rounded">⌘K</kbd>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Workspace */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary rounded-lg transition-colors">
          <span className="font-medium">{user?.workspace_name ?? 'Workspace'}</span>
          <ChevronDown size={14} />
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-text-muted hover:text-text-secondary hover:bg-surface-secondary rounded-lg transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
        </button>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 px-2 py-1 hover:bg-surface-secondary rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-brand-light rounded-full flex items-center justify-center text-white text-xs font-medium">
              {user?.name?.charAt(0) ?? 'U'}
            </div>
            <ChevronDown size={14} className="text-text-muted" />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 w-56 bg-white border border-border rounded-xl shadow-lg py-1 z-50">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-text-primary">{user?.name}</p>
                <p className="text-xs text-text-muted">{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-brand/10 text-brand rounded-full capitalize">
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-danger hover:bg-surface-secondary transition-colors"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
