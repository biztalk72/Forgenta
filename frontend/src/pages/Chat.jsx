import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, FileText } from "lucide-react";
import { streamChat, fetchChatContext } from "../lib/api";
import { parseResponse } from "../lib/parseResponse";
import ChartBlock from "../components/ChartBlock";
import TableBlock from "../components/TableBlock";

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const parsed = isUser ? null : parseResponse(msg.content);

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot size={14} />
        </div>
      )}
      <div className={`max-w-[75%] ${isUser ? "order-first" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-gray-800 text-gray-100 rounded-tl-sm"
          }`}
        >
          {isUser ? msg.content : parsed?.text}
          {msg.streaming && (
            <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse rounded-sm" />
          )}
        </div>
        {!isUser && parsed?.charts.map((c, i) => <ChartBlock key={i} chart={c} />)}
        {!isUser && parsed?.tables.map((t, i) => <TableBlock key={i} table={t} />)}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User size={14} />
        </div>
      )}
    </div>
  );
}

function ContextPanel({ docs }) {
  if (!docs.length) return null;
  const DOMAIN_COLOR = {
    manufacturing: "text-blue-400 bg-blue-900/30",
    hr: "text-violet-400 bg-violet-900/30",
    finance: "text-amber-400 bg-amber-900/30",
  };
  return (
    <div className="border-t border-gray-800 px-4 py-3">
      <p className="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
        <FileText size={11} /> RAG context
      </p>
      <div className="flex flex-wrap gap-2">
        {docs.map((d) => (
          <span
            key={d.id}
            className={`text-xs px-2 py-1 rounded-lg ${DOMAIN_COLOR[d.domain] ?? "text-gray-400 bg-gray-800"}`}
          >
            {d.title}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState([]);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    // Fetch context in parallel with starting stream
    fetchChatContext(text).then((d) => setContext(d.context ?? []));

    const assistantIdx = messages.length + 1;
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    let accumulated = "";
    try {
      for await (const chunk of streamChat(text, history)) {
        accumulated += chunk;
        setMessages((prev) =>
          prev.map((m, i) =>
            i === assistantIdx ? { ...m, content: accumulated } : m
          )
        );
      }
    } finally {
      setMessages((prev) =>
        prev.map((m, i) => (i === assistantIdx ? { ...m, streaming: false } : m))
      );
      setBusy(false);
      textareaRef.current?.focus();
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-lg font-semibold">Chat</h1>
        <p className="text-xs text-gray-500 mt-0.5">RAG · qwen3:0.6b · streaming</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot size={40} className="text-gray-700 mb-4" />
            <p className="text-gray-500 text-sm">Ask anything about manufacturing, HR, or finance data.</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {[
                "CNC 불량률을 분석해줘",
                "부서별 인원 현황 알려줘",
                "분기별 매출 추이 보여줘",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      <ContextPanel docs={context} />

      <div className="px-4 pb-4 pt-2 border-t border-gray-800">
        <div className="flex items-end gap-2 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 focus-within:border-indigo-600 transition-colors">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="메시지를 입력하세요… (Shift+Enter 줄바꿈)"
            className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-100 placeholder-gray-600 py-1 max-h-36"
            style={{ fieldSizing: "content" }}
            disabled={busy}
          />
          <button
            onClick={send}
            disabled={!input.trim() || busy}
            className="mb-1 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
