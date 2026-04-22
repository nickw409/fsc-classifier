import type { ClassifyResponse } from "./types";

export type ClassifyInput = {
  companyName: string;
  websiteUrl?: string;
  email?: string;
  description?: string;
  pdf?: File;
};

export async function classify(input: ClassifyInput): Promise<ClassifyResponse> {
  const fd = new FormData();
  fd.set("companyName", input.companyName);
  if (input.websiteUrl) fd.set("websiteUrl", input.websiteUrl);
  if (input.email) fd.set("email", input.email);
  if (input.description) fd.set("description", input.description);
  if (input.pdf) fd.set("pdf", input.pdf);

  const res = await fetch("/api/classify", { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`classify failed: HTTP ${res.status} — ${text.slice(0, 200)}`);
  }
  return (await res.json()) as ClassifyResponse;
}
