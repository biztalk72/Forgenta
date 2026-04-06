import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, Bot, AppWindow, Wrench, Database, Shield,
  ChevronLeft, ChevronRight, Star, Clock,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { clsx } from 'clsx';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/catalog/agents', icon: Bot, label: 'Agent Catalog' },
  { to: '/catalog/apps', icon: AppWindow, label: 'App Catalog' },
  { to: '/builder', icon: Wrench, label: 'Builder' },
  { to: '/datasets', icon: Database, label: 'Datasets' },
];

const adminItems = [
  { to: '/admin', icon: Shield, label: 'Admin Console' },
];

const bottomItems = [
  { to: '/recent', icon: Clock, label: 'Recent' },
  { to: '/favorites', icon: Star, label: 'Favorites' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  return (
    <aside
      className={clsx(
        'flex flex-col bg-white border-r border-border h-screen transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0">
        <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white font-bold text-sm">
          F
        </div>
        {!collapsed && (
          <span className="font-semibold text-text-primary text-sm truncate">
            Forgenta
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-brand/10 text-brand font-medium'
                      : 'text-text-secondary hover:bg-surface-secondary',
                  )
                }
              >
                <item.icon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}

          {isAdmin && (
            <>
              <li className="pt-3 pb-1 px-3">
                {!collapsed && (
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </li>
              {adminItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        isActive
                          ? 'bg-brand/10 text-brand font-medium'
                          : 'text-text-secondary hover:bg-surface-secondary',
                      )
                    }
                  >
                    <item.icon size={18} />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </>
          )}
        </ul>

        <div className="mt-auto pt-4 border-t border-border-light mx-2">
          <ul className="space-y-0.5 px-0">
            {bottomItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-brand/10 text-brand font-medium'
                        : 'text-text-secondary hover:bg-surface-secondary',
                    )
                  }
                >
                  <item.icon size={18} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-border text-text-muted hover:text-text-secondary transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
