const BASE = "/api";

export async function fetchHealth() {
  const r = await fetch(`${BASE}/health`);
  return r.json();
}

export async function fetchAgents() {
  const r = await fetch(`${BASE}/catalog/agents`);
  const d = await r.json();
  return d.items ?? [];
}

export async function fetchApps() {
  const r = await fetch(`${BASE}/catalog/apps`);
  const d = await r.json();
  return d.items ?? [];
}

export async function cloneAgent(agentId, name, description) {
  const r = await fetch(`${BASE}/catalog/agents/${agentId}/clone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  return r.json();
}

export async function refinePrompt(text) {
  const r = await fetch(`${BASE}/prompt/refine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return r.json();
}

export async function findSimilar(text) {
  const r = await fetch(`${BASE}/prompt/similar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return r.json();
}

export async function savePrompt(text, metadata = {}) {
  const r = await fetch(`${BASE}/prompt/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, metadata }),
  });
  return r.json();
}

export async function* streamRefine(text) {
  const r = await fetch(`${BASE}/prompt/refine/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}

export async function* streamChat(message, history) {
  const r = await fetch(`${BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}

export async function fetchChatContext(message) {
  const r = await fetch(`${BASE}/chat/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return r.json();
}
