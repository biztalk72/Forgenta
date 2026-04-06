import { useState } from 'react';
import { Send, Sparkles, ArrowRightLeft, Bot, AppWindow } from 'lucide-react';
import { mockMessages, mockSessions, mockCatalogItems, mockChartData, mockTableData } from '@/lib/mockData';
import type { ChatMessage } from '@/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type OutputTab = 'text' | 'table' | 'chart';

export function DashboardPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [showCompare, setShowCompare] = useState(false);
  const [activeTab, setActiveTab] = useState<OutputTab>('text');
  const [sending, setSending] = useState(false);

  const recentAgents = mockCatalogItems.filter((i) => i.type === 'agent').slice(0, 3);
  const recentApps = mockCatalogItems.filter((i) => i.type === 'app').slice(0, 3);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`, role: 'user', content: input, created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    // Mock AI response
    await new Promise((r) => setTimeout(r, 1200));
    const aiMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`, role: 'assistant',
      content: `입력하신 "${userMsg.content}"에 대해 분석 중입니다.\n\n관련 데이터를 검색하고 결과를 구조화하여 제공하겠습니다. 우측 출력 패널에서 상세 결과를 확인할 수 있습니다.`,
      artifacts: [{ id: `art-${Date.now()}`, artifact_type: 'chart2d', storage_uri: '', mime_type: 'application/json', metadata: {}, created_at: new Date().toISOString() }],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, aiMsg]);
    setSending(false);
    setShowCompare(true);
  };

  return (
    <div className="flex h-full">
      {/* ── Left: Session history ── */}
      <div className="w-56 border-r border-border bg-white shrink-0 flex flex-col">
        <div className="px-3 py-3 border-b border-border">
          <button className="w-full py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors">
            + New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {mockSessions.map((s) => (
            <button key={s.id} className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-surface-secondary rounded-lg truncate transition-colors">
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* ── Center: Chat + Prompt Compare ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="text-brand" size={28} />
              </div>
              <h2 className="text-lg font-semibold text-text-primary mb-1">Forgenta에 질문하세요</h2>
              <p className="text-sm text-text-muted max-w-sm">
                내부 데이터 기반으로 답변하고, 프롬프트를 정제하며, 유사 예제를 추천합니다.
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-brand text-white rounded-br-md'
                  : 'bg-white border border-border text-text-primary rounded-bl-md'
              }`}>
                {msg.content.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
                ))}
                {msg.artifacts && msg.artifacts.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {msg.artifacts.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1 px-2 py-1 bg-brand/10 text-brand text-xs rounded-full">
                        📊 {a.artifact_type}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="px-4 py-3 bg-white border border-border rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-brand/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-brand/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-brand/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Prompt Compare */}
        {showCompare && (
          <div className="border-t border-border bg-white px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRightLeft size={14} className="text-brand" />
              <span className="text-xs font-medium text-text-secondary">Prompt Refinement</span>
              <button onClick={() => setShowCompare(false)} className="ml-auto text-xs text-text-muted hover:text-text-secondary">닫기</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-surface-secondary rounded-lg">
                <span className="text-xs font-medium text-text-muted block mb-1">Original</span>
                <p className="text-sm text-text-primary">3월 생산라인 A의 불량률 추이를 분석해주세요.</p>
              </div>
              <div className="p-3 bg-brand/5 rounded-lg border border-brand/20">
                <span className="text-xs font-medium text-brand block mb-1">Refined</span>
                <p className="text-sm text-text-primary">2026년 3월 1일~31일 기간, 생산라인 A의 일별 불량률 추이를 분석하고, 불량 유형별 분포와 이상치 발생 원인을 포함해 주세요.</p>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="border-t border-border bg-white px-4 py-3">
          <span className="text-xs font-medium text-text-muted mb-2 block">Recommended</span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentAgents.map((item) => (
              <button key={item.id} className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-surface-secondary rounded-lg text-xs text-text-secondary hover:bg-surface-tertiary transition-colors border border-transparent hover:border-border">
                <Bot size={14} className="text-brand" />
                <span className="truncate max-w-[140px]">{item.name}</span>
              </button>
            ))}
            {recentApps.slice(0, 2).map((item) => (
              <button key={item.id} className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-surface-secondary rounded-lg text-xs text-text-secondary hover:bg-surface-tertiary transition-colors border border-transparent hover:border-border">
                <AppWindow size={14} className="text-success" />
                <span className="truncate max-w-[140px]">{item.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border bg-white px-4 py-3">
          <div className="flex items-center gap-2 bg-surface-secondary border border-border rounded-xl px-4 py-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="질문을 입력하세요..."
              className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="p-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Output Panel ── */}
      <div className="w-96 border-l border-border bg-white shrink-0 flex flex-col">
        <div className="flex border-b border-border">
          {(['text', 'table', 'chart'] as OutputTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-brand border-b-2 border-brand'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab === 'text' ? 'Text' : tab === 'table' ? 'Table' : 'Chart'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'text' && (
            <div className="prose prose-sm max-w-none">
              <h4 className="text-sm font-semibold text-text-primary">분석 결과</h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                3월 생산라인 A의 전체 불량률은 2.3%로, 전월(1.9%) 대비 0.4%p 상승했습니다.
                3월 둘째 주(10일~14일)에 불량률이 급등하였으며, 이는 원자재 로트 변경에 의한 치수 불량 증가가 주원인입니다.
              </p>
              <ul className="text-sm text-text-secondary space-y-1 mt-3">
                <li>평균 불량률: 2.3%</li>
                <li>최대 불량일: 3/12 (4.1%)</li>
                <li>치수 불량 58%, 외관 불량 27%, 기능 불량 15%</li>
              </ul>
            </div>
          )}
          {activeTab === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {mockTableData.columns.map((col) => (
                      <th key={col} className="text-left py-2 px-2 text-xs font-medium text-text-muted">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mockTableData.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border-light hover:bg-surface-secondary">
                      {row.map((cell, j) => (
                        <td key={j} className="py-2 px-2 text-text-primary">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="mt-3 px-3 py-1.5 text-xs font-medium text-brand bg-brand/10 rounded-lg hover:bg-brand/20 transition-colors">
                ⬇ Download CSV
              </button>
            </div>
          )}
          {activeTab === 'chart' && (
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-4">{mockChartData.title}</h4>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={mockChartData.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey={mockChartData.x_key} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey={mockChartData.y_key} stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
