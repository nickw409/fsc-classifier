export type HeaderState = "empty" | "loading" | "result" | "sparse" | "error" | "empty_codes";

const MAP: Record<HeaderState, { kicker?: string; title: string; sub: string }> = {
  empty: {
    title: "Classify a company",
    sub: "Run a single company against the Federal Supply Classification system.",
  },
  loading: {
    kicker: "In progress",
    title: "Classifying…",
    sub: "This typically takes 6–12 seconds per company.",
  },
  result: {
    kicker: "Result",
    title: "Classification complete",
    sub: "Codes are grouped by Federal Supply Group.",
  },
  sparse: {
    kicker: "Result",
    title: "Low-signal classification",
    sub: "Few inputs available — treat matches as directional.",
  },
  error: {
    kicker: "Result",
    title: "Classification failed",
    sub: "The classifier could not gather enough evidence.",
  },
  empty_codes: {
    kicker: "Result",
    title: "No matches found",
    sub: "The company's public materials don't clearly map to any FSC code.",
  },
};

export default function MainHeader({ state }: { state: HeaderState }) {
  const m = MAP[state];
  return (
    <div className="mb-[18px]">
      {m.kicker && (
        <div className="text-[10.5px] font-semibold tracking-[0.8px] uppercase text-ink-4">
          {m.kicker}
        </div>
      )}
      <h1 className="mt-[3px] mb-[3px] text-[22px] font-semibold tracking-[-0.3px] text-ink">
        {m.title}
      </h1>
      <div className="text-[13px] text-ink-3">{m.sub}</div>
    </div>
  );
}
