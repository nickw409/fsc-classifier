import { useState } from "react";
import CompanyForm from "./components/CompanyForm";
import ResultsDisplay from "./components/ResultsDisplay";
import { classify, type ClassifyInput } from "./api";
import type { ClassifyResponse } from "./types";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: ClassifyInput) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await classify(input);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">FSC Classifier</h1>
          <p className="text-sm text-gray-600">
            Classify a company against the U.S. Federal Supply Classification system.
          </p>
        </header>
        <CompanyForm onSubmit={handleSubmit} disabled={loading} />
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded">{error}</div>
        )}
        {result && <ResultsDisplay data={result} />}
      </div>
    </div>
  );
}
