import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Bot, AppWindow, Cpu, Database, TrendingUp, Users, ShieldCheck, ShieldOff, Gauge, Eye, ListTodo, CheckCircle, XCircle, Clock } from "lucide-react";
import { fetchHealth, fetchAgents, fetchApps, fetchGuardrailStats, fetchTasks } from "../lib/api";

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${accent}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-semibold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ ok }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
        ok ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
      {ok ? "All systems operational" : "Backend unreachable"}
    </span>
  );
}

const DOMAIN_COLOR = {
  manufacturing: "bg-blue-900/40 text-blue-400",
  hr: "bg-violet-900/40 text-violet-400",
  finance: "bg-amber-900/40 text-amber-400",
};

const STATUS_COLOR = {
  Active: "bg-emerald-900/40 text-emerald-400",
  Draft: "bg-gray-800 text-gray-500",
};

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [agents, setAgents] = useState([]);
  const [apps, setApps] = useState([]);
  const [guardrail, setGuardrail] = useState(null);
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([fetchHealth(), fetchAgents(), fetchApps(), fetchGuardrailStats(), fetchTasks(5)]).then(
      ([h, a, ap, g, t]) => {
        setHealth(h.status === "fulfilled" ? h.value : null);
        setAgents(a.status === "fulfilled" ? a.value : []);
        setApps(ap.status === "fulfilled" ? ap.value : []);
        setGuardrail(g.status === "fulfilled" ? g.value : null);
        setRecentTasks(t.status === "fulfilled" ? (t.value.tasks ?? []) : []);
        setLoading(false);
      }
    );
  }, []);

  const isHealthy = health?.status === "ok";
  const activeAgents = agents.filter((a) => a.status === "Active").length;
  const totalUsage = [...agents, ...apps].reduce((s, i) => s + (i.usage_count ?? 0), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Forgenta Hybrid Agentic AI Platform</p>
        </div>
        {!loading && <StatusBadge ok={isHealthy} />}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Activity} label="API Status" value={isHealthy ? "OK" : "Down"} sub={health?.product} accent={isHealthy ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"} />
          <StatCard icon={Bot} label="Agents" value={agents.length} sub={`${activeAgents} active`} accent="bg-indigo-900/50 text-indigo-400" />
          <StatCard icon={AppWindow} label="Apps" value={apps.length} sub="in catalog" accent="bg-violet-900/50 text-violet-400" />
          <StatCard icon={TrendingUp} label="Total Usage" value={totalUsage.toLocaleString()} sub="all-time runs" accent="bg-amber-900/50 text-amber-400" />
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Infrastructure */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Cpu size={14} className="text-gray-500" /> Infrastructure
          </h2>
          <ul className="space-y-2.5 text-sm">
            {[
              ["LLM", "IBM Granite 4.1 · 8B"],
              ["Embeddings", "Granite 4.1 (ibm)"],
              ["Vector DB", "ChromaDB (in-memory)"],
              ["Backend", "FastAPI 0.115 · Python 3.12"],
              ["Frontend", "React 19 · Vite 8 · Tailwind 4"],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between items-center">
                <span className="text-gray-500">{k}</span>
                <span className="text-gray-300 font-mono text-xs bg-gray-800 px-2 py-0.5 rounded">{v}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Top catalog items */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Database size={14} className="text-gray-500" /> Top Catalog Items
          </h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <ul className="space-y-2">
              {[...agents, ...apps]
                .sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0))
                .slice(0, 5)
                .map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${DOMAIN_COLOR[item.domain] ?? "bg-gray-800 text-gray-400"}`}>
                        {item.domain}
                      </span>
                      <span className="text-gray-300 truncate">{item.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{item.usage_count} runs</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {/* Guardrail panel */}
      <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          <ShieldCheck size={14} className="text-emerald-500" /> Guardrail
        </h2>
        {guardrail ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Gauge,      label: "Total Requests",  value: guardrail.total_requests,  accent: "bg-indigo-900/40 text-indigo-400" },
              { icon: ShieldOff,  label: "Blocked Inputs",  value: guardrail.blocked_input,   accent: "bg-red-900/40 text-red-400" },
              { icon: Activity,   label: "Rate Limited",    value: guardrail.rate_limited,    accent: "bg-amber-900/40 text-amber-400" },
              { icon: Eye,        label: "PII Redactions",  value: guardrail.pii_redactions,  accent: "bg-violet-900/40 text-violet-400" },
            ].map(({ icon: Icon, label, value, accent }) => (
              <div key={label} className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${accent} flex-shrink-0`}>
                  <Icon size={15} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-semibold mt-0.5">{value ?? 0}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600">No guardrail data available</p>
        )}
      </div>

      {/* Recent tasks */}
      <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <ListTodo size={14} className="text-indigo-400" /> Recent Tasks
          </h2>
          <Link to="/tasks" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            View all →
          </Link>
        </div>
        {recentTasks.length === 0 ? (
          <p className="text-xs text-gray-600">No tasks yet — run an agent from the Tasks page.</p>
        ) : (
          <ul className="space-y-2">
            {recentTasks.map((task) => {
              const icon =
                task.status === "done" ? <CheckCircle size={13} className="text-emerald-400" /> :
                task.status === "failed" ? <XCircle size={13} className="text-red-400" /> :
                <Clock size={13} className="text-amber-400 animate-pulse" />;
              return (
                <li key={task.id} className="flex items-center gap-3 text-sm">
                  {icon}
                  <span className="text-gray-400 truncate flex-1">{task.agent_name}</span>
                  <span className="text-xs text-gray-600 truncate max-w-xs hidden md:block">{task.input}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    task.status === "done" ? "bg-emerald-900/40 text-emerald-400" :
                    task.status === "failed" ? "bg-red-900/40 text-red-400" :
                    task.status === "running" ? "bg-blue-900/40 text-blue-400" :
                    "bg-gray-800 text-gray-500"
                  }`}>{task.status}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Agents grid */}
      {!loading && agents.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Users size={14} className="text-gray-500" /> Agents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {agents.map((agent) => (
              <div key={agent.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-200">{agent.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[agent.status] ?? "bg-gray-800 text-gray-400"}`}>
                    {agent.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{agent.description}</p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {agent.tags?.map((t) => (
                    <span key={t} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{t}</span>
                  ))}
                  <span className="ml-auto text-xs text-gray-600">{agent.usage_count} runs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
