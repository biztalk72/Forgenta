// Parse LLM response text into { text, charts, tables }
// Extracts ```json:chart and ```json:table fenced blocks
export function parseResponse(raw) {
  const charts = [];
  const tables = [];

  const cleaned = raw
    .replace(/```json:chart\n([\s\S]*?)```/g, (_, json) => {
      try { charts.push(JSON.parse(json.trim())); } catch {}
      return "";
    })
    .replace(/```json:table\n([\s\S]*?)```/g, (_, json) => {
      try { tables.push(JSON.parse(json.trim())); } catch {}
      return "";
    })
    .trim();

  return { text: cleaned, charts, tables };
}
