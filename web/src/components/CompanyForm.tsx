import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { FileText, Link as LinkIcon, Mail, Type, X } from "lucide-react";
import type { ClassifyInput } from "../api";

type Props = {
  onSubmit: (input: ClassifyInput) => void;
  disabled?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(?:https?:\/\/)?[^\s/$.?#][^\s]*\.[^\s]{2,}$/i;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function FieldLabel({
  icon,
  text,
  optional,
  htmlFor,
}: {
  icon: ReactNode;
  text: string;
  optional?: boolean;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center gap-[6px] mb-[5px]">
      <span className="text-ink-3">{icon}</span>
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink-2">
        {text}
      </label>
      {optional && <span className="text-[11px] text-ink-4">optional</span>}
    </div>
  );
}

const INPUT_BASE =
  "w-full block bg-bg-elev border rounded-md text-[13.5px] text-ink placeholder:text-ink-4 outline-none transition-colors px-[10px] py-[8px] focus:ring-[3px]";

export default function CompanyForm({ onSubmit, disabled }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [pdf, setPdf] = useState<File | undefined>(undefined);
  const [pdfDropError, setPdfDropError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const nameError = attempted && !companyName.trim() ? "Company name is required" : null;
  const urlError = websiteUrl.trim() && !URL_RE.test(websiteUrl.trim()) ? "Not a valid URL" : null;
  const emailError = email.trim() && !EMAIL_RE.test(email.trim()) ? "Not a valid email" : null;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyName.trim()) {
      setAttempted(true);
      return;
    }
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
    setPdfDropError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function acceptDroppedFile(f: File | undefined) {
    if (!f) return;
    const isPdfByType = f.type === "application/pdf";
    const isPdfByName = /\.pdf$/i.test(f.name);
    if (!isPdfByType && !isPdfByName) {
      setPdfDropError(`"${f.name}" isn't a PDF`);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setPdfDropError(`"${f.name}" is ${formatBytes(f.size)} — 10 MB max`);
      return;
    }
    setPdfDropError(null);
    setPdf(f);
  }

  const borderCls = (err: string | null) =>
    err ? "border-err-border focus:border-err-border focus:ring-err-bg" : "border-border focus:border-accent focus:ring-accent-bg";

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-bg-elev border border-border rounded-[10px] p-5 fade-up"
      noValidate
    >
      <div className="grid gap-[14px]">
        {/* Company name */}
        <div>
          <FieldLabel icon={<Type size={12} strokeWidth={1.8} aria-hidden />} text="Company name" htmlFor="companyName" />
          <input
            id="companyName"
            name="companyName"
            className={`${INPUT_BASE} ${borderCls(nameError)}`}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Loos & Co., Inc."
            required
            autoFocus
            aria-invalid={Boolean(nameError)}
          />
          {nameError && <div className="mt-[5px] text-[11.5px] text-err-fg">{nameError}</div>}
        </div>

        {/* URL + Email row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
          <div>
            <FieldLabel icon={<LinkIcon size={12} strokeWidth={1.8} aria-hidden />} text="Website URL" optional htmlFor="websiteUrl" />
            <input
              id="websiteUrl"
              type="url"
              inputMode="url"
              autoComplete="url"
              className={`${INPUT_BASE} ${borderCls(urlError)}`}
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              aria-invalid={Boolean(urlError)}
            />
            {urlError && <div className="mt-[5px] text-[11.5px] text-err-fg">{urlError}</div>}
          </div>
          <div>
            <FieldLabel icon={<Mail size={12} strokeWidth={1.8} aria-hidden />} text="Contact email" optional htmlFor="email" />
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className={`${INPUT_BASE} ${borderCls(emailError)}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sales@example.com"
              aria-invalid={Boolean(emailError)}
            />
            {emailError && <div className="mt-[5px] text-[11.5px] text-err-fg">{emailError}</div>}
          </div>
        </div>

        {/* Description */}
        <div>
          <FieldLabel icon={<Type size={12} strokeWidth={1.8} aria-hidden />} text="Description" optional htmlFor="description" />
          <textarea
            id="description"
            rows={3}
            className={`${INPUT_BASE} ${borderCls(null)} resize-y leading-[1.5] font-sans`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short free-text description of what the company does, sells, or provides."
          />
        </div>

        {/* PDF dropzone */}
        <div>
          <FieldLabel icon={<FileText size={12} strokeWidth={1.8} aria-hidden />} text="Capability statement" optional />
          {pdf ? (
            <div className="flex items-center gap-[10px] border border-border-strong rounded-md px-[12px] py-[10px] bg-bg-subtle text-[12.5px] text-ink-2">
              <FileText size={14} strokeWidth={1.6} aria-hidden />
              <span className="font-medium text-ink truncate flex-1">{pdf.name}</span>
              <span className="text-[11px] text-ink-4 shrink-0">{formatBytes(pdf.size)}</span>
              <button
                type="button"
                onClick={clearPdf}
                className="rounded p-1 text-ink-3 hover:bg-bg-elev hover:text-ink"
                aria-label="Remove selected PDF"
                title="Remove"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          ) : (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
                if (!isDragging) setIsDragging(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Only unhighlight when we actually leave the label, not
                // when dragging over a child (fires on both).
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                acceptDroppedFile(e.dataTransfer?.files?.[0]);
              }}
              className={`flex items-center gap-[10px] border border-dashed rounded-md px-[12px] py-[10px] cursor-pointer text-[12.5px] transition-colors ${
                isDragging
                  ? "bg-accent-bg border-accent text-accent-hi"
                  : "bg-bg-subtle border-border-strong text-ink-3 hover:bg-bg-elev"
              }`}
            >
              <FileText size={14} strokeWidth={1.6} aria-hidden />
              <span>
                {isDragging ? (
                  "Release to attach"
                ) : (
                  <>
                    Drop a PDF, or <span className="text-accent underline">browse</span>
                  </>
                )}
              </span>
              <span className="ml-auto text-[11px] text-ink-4">10 MB max</span>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => acceptDroppedFile(e.target.files?.[0])}
              />
            </label>
          )}
          {pdfDropError && (
            <div className="mt-[5px] text-[11.5px] text-err-fg">{pdfDropError}</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-[18px] pt-[14px] border-t border-border">
        <div className="text-[11.5px] text-ink-4">Typical: 6–12 s per company</div>
        <button
          type="submit"
          disabled={disabled || Boolean(urlError) || Boolean(emailError)}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hi text-white border border-accent rounded-md px-4 py-2 text-[13.5px] font-medium cursor-pointer disabled:opacity-50"
        >
          {disabled ? "Classifying…" : "Classify"}
          <span className="font-mono text-[10.5px] opacity-75 border border-white/30 rounded-[3px] px-[5px] py-[1px]">⏎</span>
        </button>
      </div>
    </form>
  );
}
