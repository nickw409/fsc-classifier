import { useEffect, useState } from "react";
import { Check } from "lucide-react";

type Props = { hasWebsite: boolean; hasPdf: boolean; companyName?: string };

type Stage = { label: string; range: [number, number]; desc: string };

export default function LoadingIndicator({ hasWebsite, hasPdf, companyName }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - t0), 100);
    return () => window.clearInterval(id);
  }, []);

  const fetchDesc =
    hasPdf && hasWebsite
      ? "Scraping website and extracting PDF text"
      : hasPdf
      ? "Extracting PDF text"
      : hasWebsite
      ? "Scraping website content"
      : "Preparing inputs";

  const stages: Stage[] = [
    { label: "Fetching inputs", range: [0, 2000], desc: fetchDesc },
    { label: "Building prompt", range: [2000, 3500], desc: "Assembling 580-code FSC list with prompt caching" },
    { label: "Classifying", range: [3500, 999_999], desc: "Claude Sonnet 4.6 is reading the inputs and selecting matches" },
  ];

  const currentIdx = Math.max(0, stages.findIndex((s) => elapsed < s.range[1]));
  const seconds = (elapsed / 1000).toFixed(1);
  const currentStage = stages[currentIdx];

  return (
    <div className="fade-up bg-bg-elev border border-border rounded-[10px] p-5">
      {/* Header row */}
      <div className="flex items-center gap-[10px]">
        <div className="spinner" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-ink">
            Classifying {companyName || "company"}…
          </div>
          <div className="text-[12px] text-ink-3 truncate">{currentStage?.desc}</div>
        </div>
        <div className="font-mono text-[12px] text-ink-3">{seconds}s</div>
      </div>

      {/* Shimmer progress bar */}
      <div
        className="shimmer relative mt-[14px] h-[3px] bg-bg-subtle rounded-[2px]"
        aria-hidden
      />

      {/* Stage cards */}
      <div className="flex gap-2 mt-[14px]">
        {stages.map((s, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
          const cardCls =
            state === "active"
              ? "bg-accent-bg border-border"
              : "bg-bg-subtle border-border";
          const dimCls = state === "pending" ? "opacity-55" : "";
          return (
            <div
              key={s.label}
              className={`flex-1 px-[10px] py-[8px] rounded-md border ${cardCls} ${dimCls}`}
            >
              <div className="flex items-center gap-[6px]">
                {state === "done" ? (
                  <Check size={11} strokeWidth={2.4} className="text-ok-fg" aria-hidden />
                ) : state === "active" ? (
                  <span className="w-[6px] h-[6px] rounded-full bg-accent animate-pulse" aria-hidden />
                ) : (
                  <span className="w-[6px] h-[6px] rounded-full bg-ink-4" aria-hidden />
                )}
                <div className="text-[11px] font-semibold tracking-[0.3px] uppercase text-ink-3">
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
