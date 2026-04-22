import { useEffect, useState } from "react";

type Props = { hasWebsite: boolean; hasPdf: boolean };

// Client-side best-effort stage cycle. The server doesn't stream progress; we
// pick a plausible stage based on elapsed time since the request started.
export default function LoadingIndicator({ hasWebsite, hasPdf }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - start), 250);
    return () => window.clearInterval(id);
  }, []);

  const stage =
    elapsed < 3000 && (hasWebsite || hasPdf)
      ? hasPdf && hasWebsite
        ? "Fetching website and extracting PDF…"
        : hasPdf
        ? "Extracting PDF…"
        : "Fetching website…"
      : "Classifying with Claude…";

  const seconds = (elapsed / 1000).toFixed(1);

  return (
    <div className="p-4 bg-white rounded border border-slate-200 flex items-center gap-3">
      <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800">{stage}</div>
        <div className="text-xs text-slate-500">{seconds}s</div>
      </div>
    </div>
  );
}
