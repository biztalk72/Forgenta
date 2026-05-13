import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, MessageSquare, BookOpen, Wand2, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const nav = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/catalog", icon: BookOpen, label: "Catalog" },
  { to: "/builder", icon: Wand2, label: "Builder" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-800">
          <span className="text-lg font-semibold tracking-tight">Forgenta</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="px-3 py-3 border-t border-gray-800">
            <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-gray-800/60">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {user.name?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}
        <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-600">
          v0.1.0
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
