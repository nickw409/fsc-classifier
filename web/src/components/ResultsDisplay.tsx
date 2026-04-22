import type { ClassifyResponse, SourceStatus, EmailSourceStatus, FscCode } from "../types";

type BadgeProps = { label: string; status: SourceStatus | EmailSourceStatus };

function SourceBadge({ label, status }: BadgeProps) {
  const color = status.ok
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : status.error
    ? "bg-amber-50 text-amber-800 border-amber-200"
    : "bg-slate-50 text-slate-500 border-slate-200";
  const detail = status.ok ? `${status.chars}ch` : status.error ? status.error.slice(0, 60) : "—";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${color}`}
      title={status.error ?? ""}
    >
      <span className="font-medium">{label}</span>
      <span className="opacity-70">{detail}</span>
    </span>
  );
}

const CONFIDENCE_STYLES: Record<FscCode["confidence"], string> = {
  high: "bg-emerald-50 text-emerald-800 border-emerald-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  low: "bg-rose-50 text-rose-800 border-rose-200",
};

const UNKNOWN_CONFIDENCE_STYLE = "bg-slate-50 text-slate-600 border-slate-200";

function ConfidencePill({ confidence }: { confidence: FscCode["confidence"] }) {
  const style = CONFIDENCE_STYLES[confidence] ?? UNKNOWN_CONFIDENCE_STYLE;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${style}`}
    >
      {confidence ?? "unknown"}
    </span>
  );
}

function CodeCard({ c }: { c: FscCode }) {
  const showEvidence = c.evidence && c.evidence !== "(none)";
  return (
    <div className="p-3 bg-white rounded border border-slate-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-sm font-semibold text-slate-900">{c.code}</span>
          <span className="text-sm text-slate-700 truncate">{c.description}</span>
        </div>
        <ConfidencePill confidence={c.confidence} />
      </div>
      <p className="text-sm text-slate-700 mt-1.5">{c.reasoning}</p>
      {showEvidence && (
        <blockquote className="mt-2 border-l-2 border-slate-300 pl-3 text-sm italic text-slate-600">
          "{c.evidence}"
        </blockquote>
      )}
    </div>
  );
}

type Group = { group_code: string; group_name: string; codes: FscCode[] };

const CONFIDENCE_RANK: Record<FscCode["confidence"], number> = { high: 0, medium: 1, low: 2 };

function rankOf(c: FscCode): number {
  return CONFIDENCE_RANK[c.confidence] ?? 3;
}

function groupByFsg(codes: FscCode[]): Group[] {
  const groups = new Map<string, Group>();
  for (const c of codes) {
    const existing = groups.get(c.group_code);
    if (existing) existing.codes.push(c);
    else groups.set(c.group_code, { group_code: c.group_code, group_name: c.group_name, codes: [c] });
  }
  for (const g of groups.values()) {
    g.codes.sort((a, b) => rankOf(a) - rankOf(b) || a.code.localeCompare(b.code));
  }
  return [...groups.values()].sort((a, b) => {
    const aBest = Math.min(...a.codes.map(rankOf));
    const bBest = Math.min(...b.codes.map(rankOf));
    return aBest - bBest || a.group_code.localeCompare(b.group_code);
  });
}

export default function ResultsDisplay({ data }: { data: ClassifyResponse }) {
  const derivedUrl = (data.sources.email as EmailSourceStatus).derivedUrl;
  const groups = groupByFsg(data.codes);

  return (
    <div className="space-y-4">
      <div className="p-4 bg-white rounded border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">{data.companyName}</h2>
        <p className="text-sm text-slate-700 mt-1">{data.analysis}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <SourceBadge label="Website" status={data.sources.website} />
          <SourceBadge label="PDF" status={data.sources.pdf} />
          <SourceBadge label="Description" status={data.sources.description} />
          <SourceBadge label="Email" status={data.sources.email} />
        </div>
        {derivedUrl && (
          <div className="text-xs text-slate-500 mt-2">
            Derived URL from email: <span className="font-mono">{derivedUrl}</span>
          </div>
        )}
      </div>

      {data.codes.length === 0 ? (
        <div className="p-4 bg-white rounded border border-slate-200 text-sm text-slate-600">
          No FSC codes returned — the classifier had insufficient evidence. Try adding a description or URL.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.group_code}>
              <header className="flex items-baseline gap-2 mb-1.5">
                <span className="font-mono text-xs text-slate-500">FSG {g.group_code}</span>
                <h3 className="text-sm font-semibold text-slate-800">{g.group_name}</h3>
                <span className="text-xs text-slate-400">({g.codes.length})</span>
              </header>
              <div className="space-y-1.5">
                {g.codes.map((c) => (
                  <CodeCard key={c.code} c={c} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
