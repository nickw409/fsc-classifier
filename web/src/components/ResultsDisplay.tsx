import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  SearchX,
} from "lucide-react";
import type { ClassifyResponse, EmailSourceStatus, FscCode } from "../types";

type SortKey =
  | "confidence_group"
  | "confidence"
  | "code_asc"
  | "code_desc"
  | "group_code"
  | "description";

const RANK: Record<FscCode["confidence"], number> = { high: 0, medium: 1, low: 2 };
const rankOf = (c: FscCode) => RANK[c.confidence] ?? 3;

type SortDef = { label: string; grouped: boolean; cmp: (a: FscCode, b: FscCode) => number };

const SORTS: Record<SortKey, SortDef> = {
  confidence_group: {
    label: "Best match",
    grouped: true,
    cmp: (a, b) => rankOf(a) - rankOf(b) || a.code.localeCompare(b.code),
  },
  confidence: {
    label: "Confidence",
    grouped: false,
    cmp: (a, b) => rankOf(a) - rankOf(b) || a.code.localeCompare(b.code),
  },
  code_asc: {
    label: "Code ↑",
    grouped: false,
    cmp: (a, b) => a.code.localeCompare(b.code),
  },
  code_desc: {
    label: "Code ↓",
    grouped: false,
    cmp: (a, b) => b.code.localeCompare(a.code),
  },
  group_code: {
    label: "FSG",
    grouped: true,
    cmp: (a, b) => a.code.localeCompare(b.code),
  },
  description: {
    label: "A–Z",
    grouped: false,
    cmp: (a, b) => a.description.localeCompare(b.description),
  },
};

type Group = { group_code: string; group_name: string; codes: FscCode[] };

function groupByFsg(codes: FscCode[], cmp: (a: FscCode, b: FscCode) => number): Group[] {
  const groups = new Map<string, Group>();
  for (const c of codes) {
    const g = groups.get(c.group_code);
    if (g) g.codes.push(c);
    else groups.set(c.group_code, { group_code: c.group_code, group_name: c.group_name, codes: [c] });
  }
  for (const g of groups.values()) g.codes.sort(cmp);
  return [...groups.values()].sort((a, b) => {
    const aBest = Math.min(...a.codes.map(rankOf));
    const bBest = Math.min(...b.codes.map(rankOf));
    return aBest - bBest || a.group_code.localeCompare(b.group_code);
  });
}

function copyText(s: string) {
  try {
    void navigator.clipboard?.writeText(s);
  } catch {
    /* no-op */
  }
}

// --- Inline copy button (single code copy) ---
function CopyBtn({ value, label }: { value: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      title={`Copy ${label}`}
      onClick={() => {
        copyText(value);
        setOk(true);
        window.setTimeout(() => setOk(false), 1200);
      }}
      className="inline-flex items-center gap-1 bg-transparent hover:bg-bg-subtle border border-transparent rounded-[4px] px-[5px] py-[2px] cursor-pointer text-ink-3 text-[11px]"
    >
      {ok ? (
        <Check size={11} strokeWidth={2.2} className="text-ok-fg" aria-hidden />
      ) : (
        <Copy size={11} strokeWidth={1.8} aria-hidden />
      )}
    </button>
  );
}

// --- Confidence pill ---
function ConfidencePill({ confidence }: { confidence: FscCode["confidence"] }) {
  const palette: Record<FscCode["confidence"], string> = {
    high: "bg-ok-bg text-ok-fg border-ok-border",
    medium: "bg-warn-bg text-warn-fg border-warn-border",
    low: "bg-err-bg text-err-fg border-err-border",
  };
  const dot: Record<FscCode["confidence"], string> = {
    high: "bg-ok-fg",
    medium: "bg-warn-fg",
    low: "bg-err-fg",
  };
  const cls = palette[confidence] ?? "bg-bg-subtle text-ink-3 border-border";
  const dotCls = dot[confidence] ?? "bg-ink-3";
  return (
    <span
      className={`inline-flex items-center gap-[5px] border rounded-full px-[7px] py-[2px] text-[10.5px] font-semibold tracking-[0.4px] uppercase ${cls}`}
    >
      <span className={`w-[6px] h-[6px] rounded-full ${dotCls}`} aria-hidden />
      {confidence ?? "unknown"}
    </span>
  );
}

// --- Code card (code in badge box, copy button, evidence blockquote w/ accent border) ---
function CodeCard({ c, showEvidence = true }: { c: FscCode; showEvidence?: boolean }) {
  const hasEvidence = Boolean(c.evidence) && c.evidence !== "(none)";
  return (
    <div className="bg-bg-elev border border-border rounded-lg px-[14px] py-[12px]">
      <div className="flex items-start gap-[12px]">
        <div className="font-mono text-[14px] font-semibold text-ink bg-bg-subtle border border-border rounded-[5px] px-[8px] py-[3px] shrink-0 tracking-[0.2px]">
          {c.code}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[13.5px] font-medium text-ink">{c.description}</div>
            <ConfidencePill confidence={c.confidence} />
            <CopyBtn value={c.code} label="code" />
          </div>
          <p className="text-[13px] text-ink-2 mt-[6px] leading-[1.55]">{c.reasoning}</p>
          {showEvidence && hasEvidence && (
            <blockquote className="mt-[10px] py-[6px] pl-[12px] border-l-2 border-accent-border text-[12.5px] italic text-ink-2 leading-[1.55]">
              "{c.evidence}"
            </blockquote>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Group section ---
function GroupSection({ group, showEvidence }: { group: Group; showEvidence: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full bg-transparent border-0 pb-[6px] pt-0 px-0 cursor-pointer text-left"
      >
        {open ? (
          <ChevronDown size={12} strokeWidth={2} className="text-ink-3" aria-hidden />
        ) : (
          <ChevronRight size={12} strokeWidth={2} className="text-ink-3" aria-hidden />
        )}
        <span className="font-mono text-[11px] text-ink-3 bg-bg-subtle border border-border rounded-[4px] px-[6px] py-[1px]">
          FSG {group.group_code}
        </span>
        <span className="text-[13px] font-semibold text-ink">{group.group_name}</span>
        <span className="text-[11.5px] text-ink-4">· {group.codes.length}</span>
      </button>
      {open && (
        <div className="grid gap-[6px] pl-[20px]">
          {group.codes.map((c) => (
            <CodeCard key={c.code} c={c} showEvidence={showEvidence} />
          ))}
        </div>
      )}
    </section>
  );
}

// --- Sort bar ---
function SortBar({ sort, onChange }: { sort: SortKey; onChange: (k: SortKey) => void }) {
  return (
    <div className="flex items-center gap-[6px] flex-wrap">
      <span className="text-[11px] font-semibold tracking-[0.6px] uppercase text-ink-4 mr-[2px]">
        Sort
      </span>
      {(Object.keys(SORTS) as SortKey[]).map((k) => {
        const active = k === sort;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={`text-[11.5px] px-[8px] py-[3px] rounded-[5px] border cursor-pointer ${
              active
                ? "bg-accent-bg text-accent-hi border-accent-border"
                : "bg-transparent text-ink-3 border-border hover:bg-bg-subtle"
            }`}
          >
            {SORTS[k].label}
          </button>
        );
      })}
    </div>
  );
}

// --- Analysis card ---
function AnalysisCard({ data }: { data: ClassifyResponse }) {
  const derivedUrl = (data.sources.email as EmailSourceStatus).derivedUrl;
  return (
    <div className="bg-bg-elev border border-border rounded-[10px] p-[18px]">
      <div className="text-[10.5px] font-semibold tracking-[0.6px] uppercase text-ink-4 mb-[6px]">
        Analysis
      </div>
      <p className="m-0 text-[14px] leading-[1.55] text-ink">{data.analysis}</p>
      {derivedUrl && (
        <div className="text-[11.5px] text-ink-4 mt-[8px]">
          Derived URL from email: <span className="font-mono text-ink-3">{derivedUrl}</span>
        </div>
      )}
    </div>
  );
}

// --- Stats strip ---
function ResultsStats({ codes }: { codes: FscCode[] }) {
  const hi = codes.filter((c) => c.confidence === "high").length;
  const md = codes.filter((c) => c.confidence === "medium").length;
  const lo = codes.filter((c) => c.confidence === "low").length;
  const groups = new Set(codes.map((c) => c.group_code)).size;
  const cells: Array<{ label: string; value: number; color?: string }> = [
    { label: "Total", value: codes.length },
    { label: "High", value: hi, color: "text-ok-fg" },
    { label: "Medium", value: md, color: "text-warn-fg" },
    { label: "Low", value: lo, color: "text-err-fg" },
    { label: "Groups", value: groups },
  ];
  return (
    <div className="bg-bg-elev border border-border rounded-[10px] flex overflow-hidden">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={`flex-1 px-[14px] py-[10px] flex flex-col gap-[2px] ${
            i < cells.length - 1 ? "border-r border-border" : ""
          }`}
        >
          <div className="text-[10.5px] font-semibold tracking-[0.6px] uppercase text-ink-4">
            {c.label}
          </div>
          <div className={`font-mono text-[20px] font-semibold ${c.color ?? "text-ink"}`}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main ---
export default function ResultsDisplay({ data }: { data: ClassifyResponse }) {
  const [sort, setSort] = useState<SortKey>("confidence_group");
  const [copied, setCopied] = useState(false);
  const sortDef = SORTS[sort];
  const grouped = sortDef.grouped ? groupByFsg(data.codes, sortDef.cmp) : null;
  const flat = !sortDef.grouped ? [...data.codes].sort(sortDef.cmp) : null;
  const showEvidence = true;

  const hasAnySource =
    data.sources.website.ok ||
    data.sources.pdf.ok ||
    data.sources.description.ok ||
    data.sources.email.ok;

  function handleCsv() {
    const ordered = grouped ? grouped.flatMap((g) => g.codes) : (flat ?? []);
    const rows = ["code,description,group,confidence,reasoning"];
    for (const c of ordered) {
      rows.push(
        [c.code, c.description, c.group_name, c.confidence, c.reasoning.replace(/"/g, '""')]
          .map((v) => `"${v}"`)
          .join(","),
      );
    }
    copyText(rows.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  // Error banner case: no codes AND no usable source
  if (data.codes.length === 0 && !hasAnySource) {
    return (
      <div className="fade-up grid gap-3">
        <AnalysisCard data={data} />
        <div className="bg-warn-bg border border-warn-border text-warn-fg rounded-[10px] p-[14px] flex items-start gap-[10px]">
          <AlertTriangle size={16} strokeWidth={1.8} aria-hidden className="shrink-0 mt-[1px]" />
          <div>
            <div className="text-[13px] font-semibold">Classification could not proceed</div>
            <div className="text-[12.5px] mt-[3px] text-ink-2">
              None of the inputs yielded usable content. Add a description, URL, or PDF and try again.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty codes case (had content, just no matches)
  if (data.codes.length === 0) {
    return (
      <div className="fade-up grid gap-3">
        <AnalysisCard data={data} />
        <div className="bg-bg-elev border border-border rounded-[10px] px-[20px] py-[28px] text-center">
          <div className="inline-flex w-[40px] h-[40px] items-center justify-center rounded-full bg-bg-subtle border border-border text-ink-4 mb-[10px]">
            <SearchX size={18} strokeWidth={1.6} aria-hidden />
          </div>
          <div className="text-[14px] font-semibold text-ink">No FSC codes matched</div>
          <div className="text-[12.5px] text-ink-3 mt-1 max-w-[420px] mx-auto">
            The classifier had insufficient evidence to select any 4-digit code. Adding a website,
            description, or capability PDF usually helps.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up grid gap-[14px]">
      <AnalysisCard data={data} />
      <ResultsStats codes={data.codes} />
      <div className="flex items-center justify-between px-[2px] gap-[10px] flex-wrap">
        <SortBar sort={sort} onChange={setSort} />
        <button
          type="button"
          onClick={handleCsv}
          className="inline-flex items-center gap-[6px] bg-transparent border border-border rounded-md px-[9px] py-[4px] text-[12px] cursor-pointer text-ink-2 hover:bg-bg-subtle"
        >
          <Download size={11} strokeWidth={1.8} aria-hidden />
          {copied ? "Copied" : "Copy as CSV"}
        </button>
      </div>
      {grouped ? (
        <div className="grid gap-[14px]">
          {grouped.map((g) => (
            <GroupSection key={g.group_code} group={g} showEvidence={showEvidence} />
          ))}
        </div>
      ) : (
        <div className="grid gap-[6px]">
          {flat!.map((c) => (
            <CodeCard key={c.code} c={c} showEvidence={showEvidence} />
          ))}
        </div>
      )}
    </div>
  );
}
