// Smoke test — hits the live /api/classify endpoint with a multipart POST.
// Usage: ensure `npm run dev` is running in another terminal, then `npm run smoke`.

import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "../../data");

type FscCode = {
  code: string;
  description: string;
  group_code: string;
  group_name: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  evidence: string;
};

type SourceStatus = { ok: boolean; chars: number; error?: string };

type ClassifyBody = {
  companyName?: string;
  analysis?: string;
  sources?: {
    website?: SourceStatus;
    pdf?: SourceStatus;
    description?: SourceStatus;
  };
  codes?: FscCode[];
};

type SmokeCase = {
  name: string;
  companyName: string;
  websiteUrl?: string;
  email?: string;
  description?: string;
  pdfPath?: string;
  skipIfPdfMissing?: boolean;
  expect: {
    minWebsiteChars?: number;
    minPdfChars?: number;
    minCodes?: number;
    codeMatches?: RegExp[]; // at least one hydrated code must match each regex
  };
};

const cases: SmokeCase[] = [
  {
    name: "loos-cable",
    companyName: "Loos & Co.",
    websiteUrl: "https://www.loosco.com/",
    expect: {
      minWebsiteChars: 1000,
      minCodes: 1,
      codeMatches: [/cable|wire rope|rope|rigging|aircraft/i],
    },
  },
  {
    name: "pdf-plumbing",
    // Uses the assignment PDF itself just to verify the upload+extract path.
    // Classification quality not asserted (the doc is a list of FSC codes).
    companyName: "PDF Plumbing Check",
    pdfPath: resolve(dataDir, "AV_FSCClassAssignment._151007.pdf"),
    expect: {
      minPdfChars: 1000,
    },
  },
  {
    name: "lsdp-capability",
    companyName: "LSDP",
    pdfPath: resolve(dataDir, "LSDP Capabilites Statement.pdf"),
    skipIfPdfMissing: true,
    expect: {
      minPdfChars: 500,
      minCodes: 1,
      codeMatches: [/machin|fabricat|metal|tool/i],
    },
  },
];

async function runOne(c: SmokeCase): Promise<"pass" | "fail" | "skip"> {
  if (c.pdfPath && c.skipIfPdfMissing) {
    try {
      await stat(c.pdfPath);
    } catch {
      console.log(`[smoke] ${c.name} SKIP — ${c.pdfPath} not present`);
      return "skip";
    }
  }

  const fd = new FormData();
  fd.set("companyName", c.companyName);
  if (c.websiteUrl) fd.set("websiteUrl", c.websiteUrl);
  if (c.email) fd.set("email", c.email);
  if (c.description) fd.set("description", c.description);
  if (c.pdfPath) {
    const buf = await readFile(c.pdfPath);
    const blob = new Blob([new Uint8Array(buf)], { type: "application/pdf" });
    fd.set("pdf", blob, c.pdfPath.split("/").pop());
  }

  const res = await fetch(`${BASE}/api/classify`, { method: "POST", body: fd });
  if (!res.ok) {
    console.error(`[smoke] ${c.name} HTTP ${res.status}: ${await res.text()}`);
    return "fail";
  }
  const body = (await res.json()) as ClassifyBody;
  const failures: string[] = [];

  if (body.companyName !== c.companyName) failures.push(`companyName=${body.companyName}`);
  if (!Array.isArray(body.codes)) failures.push("codes not array");

  const webChars = body.sources?.website?.chars ?? 0;
  const pdfChars = body.sources?.pdf?.chars ?? 0;
  if (c.expect.minWebsiteChars && webChars < c.expect.minWebsiteChars) {
    failures.push(`website chars ${webChars} < ${c.expect.minWebsiteChars} (error=${body.sources?.website?.error ?? "none"})`);
  }
  if (c.expect.minPdfChars && pdfChars < c.expect.minPdfChars) {
    failures.push(`pdf chars ${pdfChars} < ${c.expect.minPdfChars} (error=${body.sources?.pdf?.error ?? "none"})`);
  }
  if (c.expect.minCodes && (body.codes?.length ?? 0) < c.expect.minCodes) {
    failures.push(`codes ${body.codes?.length ?? 0} < ${c.expect.minCodes}`);
  }
  if (c.expect.codeMatches && body.codes?.length) {
    for (const re of c.expect.codeMatches) {
      const hit = body.codes.some((k) => re.test(`${k.description} ${k.group_name}`));
      if (!hit) failures.push(`no code matches ${re}`);
    }
  }

  const descList = body.codes?.map((k) => `${k.code}:${k.description} (${k.confidence})`).join(", ");
  console.log(
    `[smoke] ${c.name} ${failures.length ? "FAIL" : "OK"} — web=${webChars}ch pdf=${pdfChars}ch codes=${body.codes?.length ?? 0}`,
  );
  if (descList) console.log(`[smoke]   ${descList}`);
  if (failures.length) console.log(`[smoke]   failures: ${failures.join("; ")}`);
  return failures.length === 0 ? "pass" : "fail";
}

async function main() {
  let pass = 0;
  let fail = 0;
  let skip = 0;
  for (const c of cases) {
    const r = await runOne(c);
    if (r === "pass") pass++;
    else if (r === "fail") fail++;
    else skip++;
  }
  console.log(`[smoke] ${pass} passed, ${fail} failed, ${skip} skipped (of ${cases.length})`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("[smoke] crashed:", e);
  process.exit(1);
});
