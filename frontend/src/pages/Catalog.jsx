import { useEffect, useState } from "react";
import { Bot, AppWindow, Search, Copy, X, ChevronRight, Users } from "lucide-react";
import { fetchAgents, fetchApps, cloneAgent } from "../lib/api";

const DOMAIN_COLOR = {
  manufacturing: "bg-blue-900/40 text-blue-400 border-blue-800",
  hr: "bg-violet-900/40 text-violet-400 border-violet-800",
  finance: "bg-amber-900/40 text-amber-400 border-amber-800",
};

const STATUS_COLOR = {
  Active: "bg-emerald-900/40 text-emerald-400",
  Draft: "bg-gray-800 text-gray-500",
};

function CatalogCard({ item, onClone }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${item.type === "agent" ? "bg-indigo-900/50 text-indigo-400" : "bg-violet-900/50 text-violet-400"}`}>
            {item.type === "agent" ? <Bot size={14} /> : <AppWindow size={14} />}
          </div>
          <span className="text-sm font-medium text-gray-200">{item.name}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[item.status] ?? "bg-gray-800 text-gray-400"}`}>
          {item.status}
        </span>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{item.description}</p>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded border ${DOMAIN_COLOR[item.domain] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>
          {item.domain}
        </span>
        {item.tags?.slice(0, 2).map((t) => (
          <span key={t} className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded">{t}</span>
        ))}
      </div>

      <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-800">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Users size={11} />
          <span>{item.owner}</span>
          <span className="text-gray-700">·</span>
          <span>{item.usage_count} runs</span>
        </div>
        {item.type === "agent" && (
          <button
            onClick={() => onClone(item)}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Copy size={12} /> Clone
          </button>
        )}
      </div>
    </div>
  );
}

function CloneModal({ item, onClose, onSuccess }) {
  const [name, setName] = useState(`${item.name} (복사)`);
  const [desc, setDesc] = useState(item.description);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const cloned = await cloneAgent(item.id, name, desc);
      onSuccess(cloned);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold">Clone Agent</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-600 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Description</label>
            <textarea
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-600 transition-colors resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || loading}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg transition-colors"
          >
            {loading ? "Cloning…" : "Clone"}
          </button>
        </div>
      </div>
    </div>
  );
}

const TABS = ["All", "agent", "app", "manufacturing", "hr", "finance"];

export default function Catalog() {
  const [agents, setAgents] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [cloneTarget, setCloneTarget] = useState(null);

  useEffect(() => {
    Promise.all([fetchAgents(), fetchApps()]).then(([a, ap]) => {
      setAgents(a);
      setApps(ap);
      setLoading(false);
    });
  }, []);

  const all = [...agents, ...apps];

  const filtered = all.filter((item) => {
    const matchTab =
      tab === "All" ||
      item.type === tab ||
      item.domain === tab;
    const matchQuery =
      !query ||
      item.name.includes(query) ||
      item.description.includes(query) ||
      item.tags?.some((t) => t.includes(query));
    return matchTab && matchQuery;
  });

  function handleCloneSuccess(cloned) {
    setAgents((prev) => [...prev, cloned]);
    setCloneTarget(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-lg font-semibold">Catalog</h1>
        <p className="text-xs text-gray-500 mt-0.5">{all.length} items · agents &amp; apps</p>
      </div>

      <div className="px-6 pt-4 pb-2 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, description, or tag…"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-8 pr-4 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-indigo-600 transition-colors"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors capitalize ${
                tab === t
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Search size={32} className="text-gray-700 mb-3" />
            <p className="text-sm text-gray-500">No items match your filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <CatalogCard key={item.id} item={item} onClone={setCloneTarget} />
            ))}
          </div>
        )}
      </div>

      {cloneTarget && (
        <CloneModal
          item={cloneTarget}
          onClose={() => setCloneTarget(null)}
          onSuccess={handleCloneSuccess}
        />
      )}
    </div>
  );
}
