import { FileText, Link as LinkIcon, Mail, Plus, RotateCw, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ClassifyResponse, EmailSourceStatus, SourceStatus } from "../types";

type Props = {
  data: ClassifyResponse;
  onEdit: () => void;
  onRerun: () => void;
};

type BadgeProps = {
  label: string;
  status: SourceStatus | EmailSourceStatus;
  icon: LucideIcon;
};

function SourceBadge({ label, status, icon: Icon }: BadgeProps) {
  const state =
    status.ok ? "ok" : status.error && status.error !== "(none)" ? "err" : "empty";
  const palette = {
    ok: "bg-ok-bg text-ok-fg border-ok-border",
    err: "bg-warn-bg text-warn-fg border-warn-border",
    empty: "bg-bg-subtle text-ink-4 border-border",
  }[state];
  const detail =
    state === "ok"
      ? `${status.chars.toLocaleString()} chars`
      : state === "err"
      ? (status.error!.length > 40 ? status.error!.slice(0, 40) + "…" : status.error!)
      : "not provided";
  return (
    <span
      title={status.error ?? ""}
      className={`inline-flex items-center gap-[6px] border rounded-md px-[8px] py-[3px] text-[12px] max-w-[240px] ${palette}`}
    >
      <Icon size={12} strokeWidth={1.8} aria-hidden />
      <span className="font-medium shrink-0">{label}</span>
      <span className="opacity-75 text-[11.5px] truncate min-w-0">{detail}</span>
    </span>
  );
}

function ToolbarButton({
  onClick,
  icon: Icon,
  label,
  primary,
}: {
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  primary?: boolean;
}) {
  const cls = primary
    ? "bg-accent hover:bg-accent-hi text-white border-accent"
    : "bg-bg-elev hover:bg-bg-subtle text-ink-2 border-border";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-[6px] border rounded-md px-[10px] py-[6px] text-[12.5px] cursor-pointer ${cls}`}
    >
      <Icon size={12} strokeWidth={1.8} aria-hidden />
      {label}
    </button>
  );
}

export default function SubmittedBar({ data, onEdit, onRerun }: Props) {
  const s = data.sources;
  const monogram = data.companyName.slice(0, 2).toUpperCase();
  const codeCount = data.codes.length;

  return (
    <div className="bg-bg-elev border border-border rounded-[10px] px-[14px] py-[12px] grid items-center gap-x-[14px] gap-y-[10px] grid-cols-[minmax(180px,auto)_1fr_auto]">
      {/* Left: monogram + name */}
      <div className="flex items-center gap-[10px] min-w-0 col-start-1">
        <div className="w-[26px] h-[26px] rounded-[5px] bg-bg-subtle border border-border grid place-items-center font-mono text-[11px] text-ink-3 shrink-0">
          {monogram}
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-ink truncate">{data.companyName}</div>
          <div className="text-[11.5px] text-ink-3">
            {codeCount} code{codeCount === 1 ? "" : "s"} · classified just now
          </div>
        </div>
      </div>

      {/* Middle: source badges */}
      <div className="flex gap-[6px] flex-wrap justify-start col-start-2 min-w-0">
        <SourceBadge label="Website" status={s.website} icon={LinkIcon} />
        <SourceBadge label="PDF" status={s.pdf} icon={FileText} />
        <SourceBadge label="Desc" status={s.description} icon={Type} />
        <SourceBadge label="Email" status={s.email} icon={Mail} />
      </div>

      {/* Right: actions */}
      <div className="flex gap-[6px] col-start-3 shrink-0">
        <ToolbarButton onClick={onRerun} icon={RotateCw} label="Re-run" />
        <ToolbarButton onClick={onEdit} icon={Plus} label="New" primary />
      </div>
    </div>
  );
}
