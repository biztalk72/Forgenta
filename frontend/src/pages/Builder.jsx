import { useState } from "react";
import { Wand2, Search, Save, Loader2, Check, ChevronRight, Sparkles } from "lucide-react";
import { streamRefine, findSimilar, savePrompt } from "../lib/api";

function SimilarCard({ prompt, onUse }) {
  return (
    <button
      onClick={() => onUse(prompt.text)}
      className="w-full text-left bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-2.5 transition-colors group"
    >
      <p className="text-xs text-gray-300 line-clamp-2">{prompt.text}</p>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-gray-600">
          {prompt.distance != null ? `dist: ${prompt.distance.toFixed(3)}` : ""}
        </span>
        <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          Use <ChevronRight size={10} />
        </span>
      </div>
    </button>
  );
}

export default function Builder() {
  const [input, setInput] = useState("");
  const [refined, setRefined] = useState("");
  const [similar, setSimilar] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleRefine() {
    if (!input.trim() || streaming) return;
    setRefined("");
    setSaved(false);
    setStreaming(true);
    try {
      for await (const chunk of streamRefine(input)) {
        setRefined((prev) => prev + chunk);
      }
    } finally {
      setStreaming(false);
    }
  }

  async function handleSimilar() {
    if (!input.trim() || searching) return;
    setSearching(true);
    try {
      const { similar: results } = await findSimilar(input);
      setSimilar(results ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function handleSave() {
    const text = refined || input;
    if (!text.trim()) return;
    await savePrompt(text);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-lg font-semibold">Prompt Builder</h1>
        <p className="text-xs text-gray-500 mt-0.5">Refine, search similar, and save prompts</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — input + actions */}
        <div className="flex flex-col flex-1 overflow-y-auto px-6 py-5 gap-4 border-r border-gray-800">
          <div>
            <label className="text-xs text-gray-500 mb-2 block uppercase tracking-wide">Raw prompt</label>
            <textarea
              rows={6}
              value={input}
              onChange={(e) => { setInput(e.target.value); setSaved(false); }}
              placeholder="CNC 가공 라인별 불량률을 분석해줘..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-indigo-600 transition-colors resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRefine}
              disabled={!input.trim() || streaming}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg text-sm transition-colors"
            >
              {streaming ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              Refine
            </button>
            <button
              onClick={handleSimilar}
              disabled={!input.trim() || searching}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg text-sm text-gray-300 transition-colors"
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Similar
            </button>
          </div>

          {/* Refined output */}
          {(refined || streaming) && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles size={11} className="text-indigo-400" /> Refined
                </label>
                <button
                  onClick={handleSave}
                  disabled={streaming}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg transition-colors ${
                    saved
                      ? "bg-emerald-900/50 text-emerald-400"
                      : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                  }`}
                >
                  {saved ? <Check size={12} /> : <Save size={12} />}
                  {saved ? "Saved" : "Save"}
                </button>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed min-h-[6rem]">
                {refined}
                {streaming && (
                  <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse rounded-sm" />
                )}
              </div>
            </div>
          )}

          {/* Quick prompts */}
          {!refined && !streaming && (
            <div className="mt-2">
              <p className="text-xs text-gray-600 mb-2">Example prompts</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "CNC 불량률을 분석해줘",
                  "부서별 예산 집행률 비교",
                  "분기별 매출 추이 차트",
                  "직원 만족도 분석",
                ].map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — similar prompts */}
        <div className="w-72 flex-shrink-0 overflow-y-auto px-4 py-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Similar Prompts</p>
          {similar.length === 0 ? (
            <p className="text-xs text-gray-700 text-center mt-8">
              Click <span className="text-gray-500">Similar</span> to search the vault.
            </p>
          ) : (
            <div className="space-y-2">
              {similar.map((p) => (
                <SimilarCard key={p.id} prompt={p} onUse={setInput} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
