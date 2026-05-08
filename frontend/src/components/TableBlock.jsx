export default function TableBlock({ table }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-800">
          <tr>
            {table.headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {table.rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-800/50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-gray-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
