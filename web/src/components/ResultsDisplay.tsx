import type { ClassifyResponse } from "../types";

export default function ResultsDisplay({ data }: { data: ClassifyResponse }) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-white rounded shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold">{data.companyName}</h2>
        <p className="text-sm text-gray-700 mt-1">{data.analysis}</p>
      </div>
      <div className="space-y-2">
        {data.codes.map((c) => (
          <div key={c.code} className="p-3 bg-white rounded shadow-sm border border-gray-200">
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-sm font-semibold">{c.code} — {c.description}</div>
              <span className="text-xs uppercase text-gray-500">{c.confidence}</span>
            </div>
            <div className="text-xs text-gray-500">{c.group_code} · {c.group_name}</div>
            <div className="text-sm text-gray-800 mt-1">{c.reasoning}</div>
            {c.evidence && c.evidence !== "(none)" && (
              <div className="text-sm text-gray-600 italic mt-1">"{c.evidence}"</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
