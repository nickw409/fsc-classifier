import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import CompanyForm from "./components/CompanyForm";
import ResultsDisplay from "./components/ResultsDisplay";
import LoadingIndicator from "./components/LoadingIndicator";
import SubmittedBar from "./components/SubmittedBar";
import MainHeader, { type HeaderState } from "./components/MainHeader";
import { classify, type ClassifyInput } from "./api";
import type { ClassifyResponse } from "./types";
import { useHistory } from "./hooks/useHistory";
import { useTheme } from "./hooks/useTheme";

function pickHeaderState(
  loading: boolean,
  error: string | null,
  result: ClassifyResponse | null,
): HeaderState {
  if (loading) return "loading";
  if (error) return "error";
  if (result) {
    if (result.codes.length === 0) {
      const anySource =
        result.sources.website.ok ||
        result.sources.pdf.ok ||
        result.sources.description.ok ||
        result.sources.email.ok;
      return anySource ? "empty_codes" : "error";
    }
    const hi = result.codes.filter((c) => c.confidence === "high").length;
    return hi === 0 && result.codes.length <= 2 ? "sparse" : "result";
  }
  return "empty";
}

export default function App() {
  const { theme, toggle } = useTheme();
  const { entries, add, select, selected, clear } = useHistory();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<ClassifyInput | null>(null);

  async function handleSubmit(input: ClassifyInput) {
    setLoading(true);
    setError(null);
    setResult(null);
    setLastInput(input);
    try {
      const data = await classify(input);
      setResult(data);
      add({
        id: crypto.randomUUID(),
        companyName: data.companyName,
        url: input.websiteUrl ?? "",
        ts: Date.now(),
        topCode: data.codes[0]?.code ?? "—",
        count: data.codes.length,
        response: data,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setLastInput(null);
    select(null);
    setTimeout(() => {
      document.querySelector<HTMLInputElement>('input[name="companyName"]')?.focus();
    }, 20);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headerState = pickHeaderState(loading, error, result);

  return (
    <div className="min-h-screen bg-bg text-ink flex">
      <Sidebar
        entries={entries}
        selected={selected}
        onSelect={(h) => {
          select(h.id);
          setResult(h.response);
          setLastInput(null);
          setError(null);
        }}
        onNew={reset}
        onClear={clear}
        theme={theme}
        onThemeToggle={toggle}
      />
      <main className="flex-1 min-w-0">
        <div className="max-w-[880px] mx-auto px-[32px] pt-[28px] pb-[80px]">
          <MainHeader state={headerState} />

          {!result && !loading && !error && <CompanyForm onSubmit={handleSubmit} disabled={loading} />}

          {loading && lastInput && (
            <div className="grid gap-[14px]">
              <SubmittedBar
                data={{
                  companyName: lastInput.companyName,
                  analysis: "",
                  sources: {
                    website: { ok: false, chars: 0 },
                    pdf: { ok: false, chars: 0 },
                    description: { ok: false, chars: 0 },
                    email: { ok: false, chars: 0 },
                  },
                  codes: [],
                }}
                onEdit={reset}
                onRerun={() => handleSubmit(lastInput)}
              />
              <LoadingIndicator
                hasWebsite={Boolean(lastInput.websiteUrl) || Boolean(lastInput.email)}
                hasPdf={Boolean(lastInput.pdf)}
                companyName={lastInput.companyName}
              />
            </div>
          )}

          {error && (
            <div className="p-4 bg-err-bg border border-err-border rounded-[10px] text-[13px] text-err-fg">
              <div className="font-semibold">Classification failed</div>
              <div className="mt-1 font-mono text-[11.5px] break-all">{error}</div>
              <button type="button" onClick={reset} className="mt-2 text-[11.5px] underline">
                Start over
              </button>
            </div>
          )}

          {result && !loading && (
            <div className="grid gap-[14px]">
              <SubmittedBar
                data={result}
                onEdit={reset}
                onRerun={() => lastInput && handleSubmit(lastInput)}
              />
              <ResultsDisplay data={result} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
