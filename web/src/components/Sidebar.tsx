import { useState } from "react";
import { Inbox, Moon, Plus, Search, Sun } from "lucide-react";
import type { HistoryEntry } from "../hooks/useHistory";

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const MOD_LABEL = IS_MAC ? "⌘" : "Ctrl";

type SidebarProps = {
  entries: HistoryEntry[];
  selected: string | null;
  onSelect: (e: HistoryEntry) => void;
  onNew: () => void;
  onClear: () => void;
  theme: "light" | "dark";
  onThemeToggle: () => void;
};

function timeAgo(ts: number): string {
  const delta = Math.max(0, Date.now() - ts);
  const m = Math.floor(delta / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// Color of the per-entry status dot: ok-fg for success, warn-fg for empty/error
// classifications, ink-4 for very low-signal.
function dotClass(e: HistoryEntry): string {
  if (e.count === 0) return "text-warn-fg";
  const topConf = e.response.codes[0]?.confidence;
  if (topConf === "low") return "text-ink-4";
  return "text-ok-fg";
}

export default function Sidebar({
  entries,
  selected,
  onSelect,
  onNew,
  onClear,
  theme,
  onThemeToggle,
}: SidebarProps) {
  const [q, setQ] = useState("");
  const filtered = entries.filter(
    (h) =>
      !q ||
      h.companyName.toLowerCase().includes(q.toLowerCase()) ||
      h.url.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <aside className="w-[260px] shrink-0 h-screen sticky top-0 flex flex-col bg-bg border-r border-border">
      {/* Brand + New */}
      <div className="px-[14px] pt-[14px] pb-[10px] border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-[22px] h-[22px] rounded-[5px] bg-accent flex items-center justify-center text-white font-mono text-[11px] font-semibold">
            F
          </div>
          <div className="font-semibold text-[13.5px] tracking-[-0.1px] text-ink">
            FSC Classifier
          </div>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hi text-white border border-accent rounded-md text-[13px] font-medium cursor-pointer px-[10px] py-[7px]"
        >
          <Plus size={13} strokeWidth={2} aria-hidden />
          <span>New classification</span>
          <span className="ml-1.5 font-mono text-[10px] opacity-75 border border-white/30 rounded-[3px] px-[5px] py-[1px]">
            {MOD_LABEL}+K
          </span>
        </button>
      </div>

      {/* Search */}
      <div className="px-[10px] pt-[10px] pb-[6px]">
        <div className="flex items-center bg-bg-elev border border-border rounded-md px-2 focus-within:border-accent">
          <Search size={13} className="text-ink-4" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search history"
            className="flex-1 bg-transparent outline-none border-0 px-2 py-1.5 text-[12.5px] text-ink placeholder:text-ink-4"
          />
        </div>
      </div>

      {/* Recent label */}
      <div className="px-[10px] pt-[4px] pb-[8px] flex items-center justify-between">
        <span className="text-[10.5px] font-semibold tracking-[0.6px] uppercase text-ink-4">
          Recent
        </span>
        <span className="text-[11px] text-ink-4">{filtered.length}</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-[6px] pb-[10px]">
        {entries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-ink-4 py-10 gap-2">
            <Inbox size={22} strokeWidth={1.6} aria-hidden />
            <div className="text-[13px] font-medium text-ink-3">No classifications yet</div>
            <div className="text-[11.5px] text-center px-4 text-ink-4">
              Submit a company and it'll show up here.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-[11.5px] text-ink-4 py-6">No matches for "{q}"</div>
        ) : (
          filtered.map((h) => {
            const active = selected === h.id;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => onSelect(h)}
                className={`w-full text-left block rounded-md px-[10px] py-[8px] mb-[2px] border cursor-pointer ${
                  active
                    ? "bg-accent-bg border-accent-border"
                    : "bg-transparent border-transparent hover:bg-bg-subtle"
                }`}
              >
                <div className="flex items-center gap-[7px]">
                  <span className={`w-[6px] h-[6px] rounded-full shrink-0 bg-current ${dotClass(h)}`} aria-hidden />
                  <div className="text-[13px] font-medium text-ink truncate flex-1">
                    {h.companyName}
                  </div>
                </div>
                <div className="flex justify-between items-center mt-[3px] pl-[13px] gap-[6px]">
                  <div className="text-[11.5px] text-ink-3 truncate">{h.url || "(no url)"}</div>
                  <div className="flex items-center gap-[6px] ml-[6px] shrink-0">
                    {h.topCode !== "—" && (
                      <span className="font-mono text-[10.5px] text-ink-3">{h.topCode}</span>
                    )}
                    <span className="text-[10.5px] text-ink-4">{timeAgo(h.ts)}</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-[14px] py-[10px] text-[11px] text-ink-4 flex items-center justify-between">
        <span>{entries.length} saved</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onThemeToggle}
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle theme"
            className="inline-flex items-center justify-center bg-transparent border border-border rounded-[5px] px-[6px] py-[3px] text-ink-3 hover:bg-bg-subtle"
          >
            {theme === "dark" ? <Sun size={12} strokeWidth={1.8} aria-hidden /> : <Moon size={12} strokeWidth={1.8} aria-hidden />}
          </button>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="bg-transparent border-0 p-0 cursor-pointer text-ink-4 hover:text-err-fg text-[11px]"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
