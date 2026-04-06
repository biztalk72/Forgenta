import { useState } from 'react';
import { Save, Play, Upload, Plus } from 'lucide-react';
import { clsx } from 'clsx';

type BuilderTab = 'prompt' | 'data' | 'outputs' | 'guardrails' | 'version';

export function BuilderPage() {
  const [activeTab, setActiveTab] = useState<BuilderTab>('prompt');
  const [name, setName] = useState('New Agent');
  const [promptText, setPromptText] = useState('');

  const tabs: { key: BuilderTab; label: string }[] = [
    { key: 'prompt', label: 'Prompt' },
    { key: 'data', label: 'Data Sources' },
    { key: 'outputs', label: 'Outputs' },
    { key: 'guardrails', label: 'Guardrails' },
    { key: 'version', label: 'Version' },
  ];

  return (
    <div className="flex h-full">
      {/* Left: Config tabs */}
      <div className="w-56 border-r border-border bg-white shrink-0 flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm font-semibold text-text-primary bg-transparent outline-none w-full border-b border-transparent focus:border-brand pb-1"
          />
          <p className="text-xs text-text-muted mt-1">agent · draft</p>
        </div>
        <nav className="flex-1 py-2 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors',
                activeTab === tab.key ? 'bg-brand/10 text-brand font-medium' : 'text-text-secondary hover:bg-surface-secondary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors">
            <Save size={16} /> Save Draft
          </button>
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-brand border border-brand/30 rounded-lg hover:bg-brand/5 transition-colors">
            <Upload size={16} /> Publish
          </button>
        </div>
      </div>

      {/* Center: Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'prompt' && (
            <div className="max-w-2xl">
              <h2 className="text-base font-semibold text-text-primary mb-4">Prompt Template</h2>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="에이전트가 사용할 프롬프트 템플릿을 작성하세요...&#10;&#10;예: 다음 데이터를 기반으로 {{query}}에 대해 분석하고, 표와 차트로 결과를 제시해 주세요."
                className="w-full h-64 p-4 border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
              <div className="mt-4 p-4 bg-surface-secondary rounded-xl">
                <h4 className="text-xs font-medium text-text-muted mb-2">Variables</h4>
                <div className="flex flex-wrap gap-2">
                  {['{{query}}', '{{context}}', '{{user_role}}', '{{output_format}}'].map((v) => (
                    <span key={v} className="px-2 py-1 bg-white border border-border rounded text-xs text-text-secondary font-mono">{v}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'data' && (
            <div className="max-w-2xl">
              <h2 className="text-base font-semibold text-text-primary mb-4">Data Sources</h2>
              <div className="space-y-3">
                {['제조 공개 데이터', 'Synthetic HR', 'Synthetic Finance'].map((ds) => (
                  <div key={ds} className="flex items-center justify-between p-4 bg-white border border-border rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{ds}</p>
                      <p className="text-xs text-text-muted">Connected · Vector indexed</p>
                    </div>
                    <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">active</span>
                  </div>
                ))}
                <button className="flex items-center gap-2 w-full p-4 border border-dashed border-border rounded-xl text-sm text-text-muted hover:border-brand hover:text-brand transition-colors">
                  <Plus size={16} /> Add Data Source
                </button>
              </div>
            </div>
          )}
          {activeTab === 'outputs' && (
            <div className="max-w-2xl">
              <h2 className="text-base font-semibold text-text-primary mb-4">Output Configuration</h2>
              <div className="grid grid-cols-2 gap-3">
                {['Text/Markdown', 'Table', 'CSV Download', 'Image', 'SVG', '2D Chart', '3D Chart'].map((out) => (
                  <label key={out} className="flex items-center gap-3 p-3 bg-white border border-border rounded-xl cursor-pointer hover:border-brand/50 transition-colors">
                    <input type="checkbox" defaultChecked={['Text/Markdown', 'Table', '2D Chart'].includes(out)} className="accent-brand" />
                    <span className="text-sm text-text-primary">{out}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'guardrails' && (
            <div className="max-w-2xl">
              <h2 className="text-base font-semibold text-text-primary mb-4">Guardrails</h2>
              <div className="space-y-3">
                {[
                  { label: 'PII Masking', desc: '개인정보(이름, 연락처 등)를 마스킹합니다.', on: true },
                  { label: 'Profanity Filter', desc: '부적절한 언어를 필터링합니다.', on: true },
                  { label: 'Data Scope Limit', desc: '허용된 데이터셋 범위만 접근합니다.', on: true },
                  { label: 'Max Token Limit', desc: '응답 토큰 수를 제한합니다.', on: false },
                ].map((g) => (
                  <div key={g.label} className="flex items-center justify-between p-4 bg-white border border-border rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{g.label}</p>
                      <p className="text-xs text-text-muted">{g.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={g.on} className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 peer-checked:bg-brand rounded-full peer-focus:ring-2 peer-focus:ring-brand/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'version' && (
            <div className="max-w-2xl">
              <h2 className="text-base font-semibold text-text-primary mb-4">Version History</h2>
              <div className="space-y-2">
                {[
                  { v: 'v1 (current)', date: '2026-04-01', status: 'draft' },
                ].map((ver) => (
                  <div key={ver.v} className="flex items-center justify-between p-4 bg-white border border-border rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{ver.v}</p>
                      <p className="text-xs text-text-muted">{ver.date}</p>
                    </div>
                    <span className="px-2 py-0.5 text-xs bg-warning/10 text-warning rounded-full">{ver.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Test panel */}
      <div className="w-80 border-l border-border bg-white shrink-0 flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Test Run</h3>
        </div>
        <div className="flex-1 p-4 flex flex-col">
          <textarea
            placeholder="테스트 입력을 작성하세요..."
            className="w-full h-32 p-3 border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <button className="flex items-center justify-center gap-2 mt-3 w-full py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors">
            <Play size={16} /> Run Test
          </button>
          <div className="flex-1 mt-4 p-3 bg-surface-secondary rounded-xl">
            <p className="text-xs text-text-muted">Test results will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
