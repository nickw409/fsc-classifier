import { useState } from "react";
import CompanyForm from "./components/CompanyForm";
import ResultsDisplay from "./components/ResultsDisplay";
import LoadingIndicator from "./components/LoadingIndicator";
import { classify, type ClassifyInput } from "./api";
import type { ClassifyResponse } from "./types";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [loadingInput, setLoadingInput] = useState<ClassifyInput | null>(null);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: ClassifyInput) {
    setLoading(true);
    setLoadingInput(input);
    setError(null);
    setResult(null);
    try {
      const data = await classify(input);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setLoadingInput(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="border-b border-slate-200 pb-4">
          <h1 className="text-xl font-semibold tracking-tight">FSC Classifier</h1>
          <p className="text-sm text-slate-600 mt-1">
            Classify a company against the U.S. Federal Supply Classification system.
          </p>
        </header>

        <CompanyForm onSubmit={handleSubmit} disabled={loading} />

        {loading && loadingInput && (
          <LoadingIndicator
            hasWebsite={Boolean(loadingInput.websiteUrl) || Boolean(loadingInput.email)}
            hasPdf={Boolean(loadingInput.pdf)}
          />
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            <div className="font-medium">Classification failed</div>
            <div className="mt-0.5 font-mono text-xs break-all">{error}</div>
          </div>
        )}

        {result && <ResultsDisplay data={result} />}
      </div>
    </div>
  );
}
