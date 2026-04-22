import type { ClassifyResponse, SourceStatus, EmailSourceStatus } from "../types";

type BadgeProps = { label: string; status: SourceStatus | EmailSourceStatus };

function SourceBadge({ label, status }: BadgeProps) {
  const color = status.ok
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : status.error
    ? "bg-amber-50 text-amber-800 border-amber-200"
    : "bg-slate-50 text-slate-500 border-slate-200";
  const detail = status.ok
    ? `${status.chars}ch`
    : status.error
    ? status.error.slice(0, 60)
    : "—";
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${color}`} title={status.error ?? ""}>
      <span className="font-medium">{label}</span>
      <span className="opacity-70">{detail}</span>
    </span>
  );
}

export default function ResultsDisplay({ data }: { data: ClassifyResponse }) {
  const derivedUrl = (data.sources.email as EmailSourceStatus).derivedUrl;
  return (
    <div className="space-y-4">
      <div className="p-4 bg-white rounded shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold">{data.companyName}</h2>
        <p className="text-sm text-gray-700 mt-1">{data.analysis}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <SourceBadge label="Website" status={data.sources.website} />
          <SourceBadge label="PDF" status={data.sources.pdf} />
          <SourceBadge label="Description" status={data.sources.description} />
          <SourceBadge label="Email" status={data.sources.email} />
        </div>
        {derivedUrl && (
          <div className="text-xs text-gray-500 mt-2">
            Derived URL from email: <span className="font-mono">{derivedUrl}</span>
          </div>
        )}
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
