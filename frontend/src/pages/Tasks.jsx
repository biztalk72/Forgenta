import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Clock, CheckCircle2, XCircle, Circle, Trash2, Plus, X,
  ArrowRight, ChevronDown, ChevronUp, Calendar, Layers, ListTodo,
} from "lucide-react";
import {
  fetchAgents, runAgentTask, fetchTasks, cancelTask,
  createPipeline, fetchPipelines, runPipeline,
  createSchedule, fetchSchedules, deleteScheduleApi,
} from "../lib/api";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const STATUS_STYLE = {
  pending:   "bg-gray-800 text-gray-400",
  running:   "bg-blue-900/40 text-blue-300 animate-pulse",
  done:      "bg-emerald-900/40 text-emerald-400",
  failed:    "bg-red-900/40 text-red-400",
  cancelled: "bg-gray-800 text-gray-600",
};

const STATUS_ICONS = { pending: Clock, running: Circle, done: CheckCircle2, failed: XCircle, cancelled: XCircle };

function StatusBadge({ status }) {
  const Icon = STATUS_ICONS[status] ?? Clock;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[status]}`}>
      <Icon size={10} /> {status}
    </span>
  );
}

function duration(task) {
  if (!task.started_at) return null;
  const end = task.finished_at ? new Date(task.finished_at) : new Date();
  const ms = end - new Date(task.started_at);
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Run modal — used for single-agent run and pipeline run
// ---------------------------------------------------------------------------

function RunModal({ title, agentId, agentName, pipelineId, onClose }) {
  const [input, setInput] = useState("");
  const [taskId, setTaskId] = useState(null);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const wsRef = useRef(null);
  const outputRef = useRef(null);

  useEffect(() => () => wsRef.current?.close(), []);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  async function handleRun() {
    if (!input.trim()) return;
    setSubmitting(true);
    setOutput("");
    setStatus("pending");
    setError("");
    try {
      let result;
      if (pipelineId) {
        result = await runPipeline(pipelineId, input);
        setStatus("started");
      } else {
        result = await runAgentTask(agentId, input);
        setTaskId(result.id);
        openWs(result.id);
      }
    } catch (err) {
      setError(err.message);
      setStatus("failed");
    } finally {
      setSubmitting(false);
    }
  }

  function openWs(id) {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/api/agents/tasks/${id}/ws`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "chunk") setOutput((p) => p + msg.chunk);
      else if (msg.type === "done") setStatus(msg.status);
      else if (msg.type === "snapshot") { setOutput(msg.output || ""); setStatus(msg.status); }
    };
    ws.onerror = () => setError("WebSocket connection failed");
    wsRef.current = ws;
  }

  const running = status === "running" || status === "pending";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {agentName && <p className="text-xs text-gray-500 mt-0.5">{agentName}</p>}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {!taskId && status !== "started" ? (
            <div className="space-y-3">
              <label className="text-xs text-gray-400 block">Input</label>
              <textarea
                rows={4}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter task input…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-indigo-600 resize-none"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={status ?? "pending"} />
                {taskId && <span className="text-xs text-gray-600 font-mono">{taskId}</span>}
              </div>
              {output && (
                <div
                  ref={outputRef}
                  className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap font-mono max-h-80 overflow-y-auto"
                >
                  {output}
                  {running && <span className="inline-block w-2 h-4 bg-indigo-400 ml-1 animate-pulse" />}
                </div>
              )}
              {status === "started" && (
                <p className="text-xs text-gray-500">Pipeline started — monitor progress in the Tasks tab.</p>
              )}
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
            {status === "done" || status === "failed" ? "Close" : "Cancel"}
          </button>
          {!taskId && status !== "started" && (
            <button
              onClick={handleRun}
              disabled={!input.trim() || submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg"
            >
              <Play size={13} /> {submitting ? "Starting…" : "Run"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tasks tab
// ---------------------------------------------------------------------------

function TaskRow({ task, onRefresh }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-gray-800 hover:bg-gray-900/50 cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
      >
        <td className="px-4 py-3 text-xs font-mono text-gray-500">{task.id.slice(0, 16)}</td>
        <td className="px-4 py-3 text-sm text-gray-200">{task.agent_name}</td>
        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{task.input}</td>
        <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
        <td className="px-4 py-3 text-xs text-gray-600">{duration(task) ?? "—"}</td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {task.status === "pending" && (
              <button
                onClick={(e) => { e.stopPropagation(); cancelTask(task.id).then(onRefresh); }}
                className="text-gray-600 hover:text-red-400 transition-colors"
                title="Cancel"
              >
                <Trash2 size={13} />
              </button>
            )}
            {expanded ? <ChevronUp size={13} className="text-gray-600" /> : <ChevronDown size={13} className="text-gray-600" />}
          </div>
        </td>
      </tr>
      {expanded && (task.output || task.error) && (
        <tr className="bg-gray-950">
          <td colSpan={6} className="px-4 py-3">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
              {task.error ? <span className="text-red-400">{task.error}</span> : task.output}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function TasksTab({ agents }) {
  const [tasks, setTasks] = useState([]);
  const [runTarget, setRunTarget] = useState(null);

  const refresh = useCallback(() => {
    fetchTasks().then((d) => setTasks(d.tasks ?? []));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  const running = tasks.filter((t) => t.status === "running").length;
  const pending = tasks.filter((t) => t.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {running > 0 && <span className="text-blue-400">{running} running</span>}
          {pending > 0 && <span>{pending} pending</span>}
          <span>{tasks.length} total</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none"
            onChange={(e) => setRunTarget(agents.find((a) => a.id === e.target.value) ?? null)}
            value={runTarget?.id ?? ""}
          >
            <option value="">Select agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            disabled={!runTarget}
            onClick={() => {}}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg"
          >
            <Play size={13} /> Run
          </button>
        </div>
      </div>

      {runTarget && (
        <RunModal
          title="Run Agent"
          agentId={runTarget.id}
          agentName={runTarget.name}
          onClose={() => { setRunTarget(null); refresh(); }}
        />
      )}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600">
          <ListTodo size={32} className="mb-2" />
          <p className="text-sm">No tasks yet — select an agent and run it.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-left">
            <thead className="bg-gray-900 border-b border-gray-800">
              <tr>
                {["Task ID", "Agent", "Input", "Status", "Duration", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => <TaskRow key={t.id} task={t} onRefresh={refresh} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipelines tab
// ---------------------------------------------------------------------------

function PipelinesTab({ agents }) {
  const [pipelines, setPipelines] = useState([]);
  const [creating, setCreating] = useState(false);
  const [runTarget, setRunTarget] = useState(null);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPipelines().then((d) => setPipelines(d.pipelines ?? []));
  }, []);

  function addStep(agent) {
    if (!agent) return;
    setSteps((p) => [...p, { agent_id: agent.id, agent_name: agent.name }]);
  }

  function removeStep(idx) {
    setSteps((p) => p.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!name.trim() || steps.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const p = await createPipeline(name, steps);
      setPipelines((prev) => [p, ...prev]);
      setCreating(false);
      setName("");
      setSteps([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg"
        >
          <Plus size={13} /> New Pipeline
        </button>
      </div>

      {creating && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium">New Pipeline</h3>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-600"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-2">Steps</label>
            <div className="space-y-2 mb-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  {i > 0 && <ArrowRight size={12} className="text-gray-600 flex-shrink-0" />}
                  <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded flex-1">{s.agent_name}</span>
                  <button onClick={() => removeStep(i)} className="text-gray-600 hover:text-red-400"><X size={12} /></button>
                </div>
              ))}
            </div>
            <select
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-400 outline-none w-full"
              onChange={(e) => { addStep(agents.find((a) => a.id === e.target.value)); e.target.value = ""; }}
              value=""
            >
              <option value="">+ Add step…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
            <button
              onClick={save}
              disabled={!name.trim() || steps.length === 0 || saving}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg"
            >
              {saving ? "Saving…" : "Save Pipeline"}
            </button>
          </div>
        </div>
      )}

      {runTarget && (
        <RunModal
          title={`Run Pipeline: ${runTarget.name}`}
          pipelineId={runTarget.id}
          onClose={() => setRunTarget(null)}
        />
      )}

      {pipelines.length === 0 && !creating ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600">
          <Layers size={32} className="mb-2" />
          <p className="text-sm">No pipelines yet — create one to chain agents.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pipelines.map((p) => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium text-gray-200">{p.name}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {p.steps.map((s, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <ArrowRight size={10} className="text-gray-600" />}
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{s.agent_name}</span>
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setRunTarget(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded-lg flex-shrink-0"
              >
                <Play size={11} /> Run
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedules tab
// ---------------------------------------------------------------------------

function SchedulesTab({ agents }) {
  const [schedules, setSchedules] = useState([]);
  const [creating, setCreating] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [input, setInput] = useState("");
  const [cron, setCron] = useState("0 9 * * 1-5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSchedules().then((d) => setSchedules(d.schedules ?? []));
  }, []);

  async function save() {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent || !input.trim() || !cron.trim()) return;
    setSaving(true);
    setError("");
    try {
      const s = await createSchedule(agentId, agent.name, input, cron);
      setSchedules((p) => [...p, s]);
      setCreating(false);
      setAgentId(""); setInput(""); setCron("0 9 * * 1-5");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    await deleteScheduleApi(id);
    setSchedules((p) => p.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg"
        >
          <Plus size={13} /> New Schedule
        </button>
      </div>

      {creating && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium">New Schedule</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-600"
              >
                <option value="">Select agent…</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Cron expression</label>
              <input
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                placeholder="0 9 * * 1-5"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono outline-none focus:border-indigo-600"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Input</label>
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 resize-none outline-none focus:border-indigo-600"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
            <button
              onClick={save}
              disabled={!agentId || !input.trim() || !cron.trim() || saving}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg"
            >
              {saving ? "Saving…" : "Save Schedule"}
            </button>
          </div>
        </div>
      )}

      {schedules.length === 0 && !creating ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600">
          <Calendar size={32} className="mb-2" />
          <p className="text-sm">No schedules yet — create one to run agents on a cron.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-left">
            <thead className="bg-gray-900 border-b border-gray-800">
              <tr>
                {["Agent", "Cron", "Input", "Last Run", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                  <td className="px-4 py-3 text-sm text-gray-200">{s.agent_name}</td>
                  <td className="px-4 py-3 text-xs font-mono text-indigo-400">{s.cron}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{s.input}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {s.last_run ? new Date(s.last_run).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(s.id)} className="text-gray-600 hover:text-red-400">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Tasks page
// ---------------------------------------------------------------------------

const TABS = [
  { id: "tasks",     icon: ListTodo, label: "Tasks" },
  { id: "pipelines", icon: Layers,   label: "Pipelines" },
  { id: "schedules", icon: Calendar, label: "Schedules" },
];

export default function Tasks() {
  const [tab, setTab] = useState("tasks");
  const [agents, setAgents] = useState([]);

  useEffect(() => { fetchAgents().then(setAgents); }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-lg font-semibold">Agent Orchestration</h1>
        <p className="text-xs text-gray-500 mt-0.5">Run agents, chain pipelines, and schedule automated jobs</p>
      </div>

      <div className="px-6 pt-4 border-b border-gray-800">
        <div className="flex gap-1">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition-colors ${
                tab === id
                  ? "bg-gray-800 text-gray-100 border-b-2 border-indigo-500"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "tasks"     && <TasksTab agents={agents} />}
        {tab === "pipelines" && <PipelinesTab agents={agents} />}
        {tab === "schedules" && <SchedulesTab agents={agents} />}
      </div>
    </div>
  );
}
