import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ClassifyInput } from "../api";

type Props = {
  onSubmit: (input: ClassifyInput) => void;
  disabled?: boolean;
};

// Looser than the RFC, tighter than "anything with @".
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Require a dot in the host; allow scheme-less ("example.com") or with scheme.
const URL_RE = /^(?:https?:\/\/)?[^\s/$.?#][^\s]*\.[^\s]{2,}$/i;

export default function CompanyForm({ onSubmit, disabled }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [pdf, setPdf] = useState<File | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const urlError = websiteUrl.trim() && !URL_RE.test(websiteUrl.trim()) ? "Not a valid URL" : null;
  const emailError = email.trim() && !EMAIL_RE.test(email.trim()) ? "Not a valid email" : null;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyName.trim()) return;
    if (urlError || emailError) return;
    onSubmit({
      companyName: companyName.trim(),
      websiteUrl: websiteUrl.trim() || undefined,
      email: email.trim() || undefined,
      description: description.trim() || undefined,
      pdf,
    });
  }

  function clearPdf() {
    setPdf(undefined);
    if (fileRef.current) fileRef.current.value = "";
  }

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 p-4 bg-white rounded border border-slate-200"
      noValidate
    >
      <div>
        <label className="block text-sm font-medium text-slate-700">Company name *</label>
        <input
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Website URL</label>
        <input
          type="url"
          inputMode="url"
          autoComplete="url"
          className={`mt-1 w-full rounded border px-3 py-2 text-sm focus:outline-none ${
            urlError ? "border-rose-400 focus:border-rose-500" : "border-slate-300 focus:border-slate-500"
          }`}
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://example.com"
          aria-invalid={Boolean(urlError)}
        />
        {urlError && <div className="mt-1 text-xs text-rose-700">{urlError}</div>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Contact email</label>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          className={`mt-1 w-full rounded border px-3 py-2 text-sm focus:outline-none ${
            emailError ? "border-rose-400 focus:border-rose-500" : "border-slate-300 focus:border-slate-500"
          }`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="sales@example.com"
          aria-invalid={Boolean(emailError)}
        />
        {emailError && <div className="mt-1 text-xs text-rose-700">{emailError}</div>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Description</label>
        <textarea
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Capability statement (PDF)</label>
        {pdf ? (
          <div className="mt-1 flex items-center justify-between gap-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1 truncate">
              <span className="font-medium text-slate-800">{pdf.name}</span>
              <span className="ml-2 text-xs text-slate-500">{formatBytes(pdf.size)}</span>
            </div>
            <button
              type="button"
              onClick={clearPdf}
              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
              aria-label="Remove selected PDF"
              title="Remove"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M6.28 5.22a.75.75 0 0 1 1.06 0L10 7.94l2.66-2.72a.75.75 0 1 1 1.08 1.04L11.06 9l2.68 2.74a.75.75 0 1 1-1.08 1.04L10 10.06l-2.66 2.72a.75.75 0 1 1-1.08-1.04L8.94 9 6.26 6.26a.75.75 0 0 1 .02-1.04Z" />
              </svg>
            </button>
          </div>
        ) : (
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="mt-1 block text-sm"
            onChange={(e) => setPdf(e.target.files?.[0])}
          />
        )}
      </div>

      <button
        type="submit"
        disabled={disabled || Boolean(urlError) || Boolean(emailError)}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
      >
        {disabled ? "Classifying…" : "Classify"}
      </button>
    </form>
  );
}
