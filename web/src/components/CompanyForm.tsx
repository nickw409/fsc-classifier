import { useState } from "react";
import type { FormEvent } from "react";
import type { ClassifyInput } from "../api";

type Props = {
  onSubmit: (input: ClassifyInput) => void;
  disabled?: boolean;
};

export default function CompanyForm({ onSubmit, disabled }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [pdf, setPdf] = useState<File | undefined>(undefined);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyName.trim()) return;
    onSubmit({
      companyName: companyName.trim(),
      websiteUrl: websiteUrl.trim() || undefined,
      email: email.trim() || undefined,
      description: description.trim() || undefined,
      pdf,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-white rounded shadow-sm border border-gray-200">
      <div>
        <label className="block text-sm font-medium text-gray-700">Company name *</label>
        <input
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Website URL</label>
        <input
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Contact email</label>
        <input
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="sales@example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Capability statement (PDF)</label>
        <input
          type="file"
          accept="application/pdf"
          className="mt-1 block text-sm"
          onChange={(e) => setPdf(e.target.files?.[0])}
        />
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
      >
        {disabled ? "Classifying…" : "Classify"}
      </button>
    </form>
  );
}
