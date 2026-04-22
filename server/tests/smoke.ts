// Smoke test — hits /api/classify (or replays a cached fixture) and asserts.
//
// Modes:
//   npm run smoke                   # live: hit server, cache responses into fixtures/
//   SMOKE_OFFLINE=1 npm run smoke   # offline: skip the server, replay cached
//                                   # fixtures. Asserts smoke logic without cost.
//   SMOKE_RECORD=1 npm run smoke    # force overwrite existing fixtures on a
//                                   # live run.
//
// Cached fixtures live in server/fixtures/<case>.json and hold the full
// ClassifyResponse from the last successful live run. They're safe to commit
// (no API keys, no large binaries) and let you iterate on assertions without
// burning OpenRouter calls.

import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OFFLINE = process.env.SMOKE_OFFLINE === "1";
const RECORD = process.env.SMOKE_RECORD === "1";
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "../../data");
const fixturesDir = resolve(here, "../fixtures");

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
    email?: SourceStatus & { derivedUrl?: string };
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
    maxCodes?: number;
    codeMatches?: RegExp[];
    websiteErrorLike?: RegExp;
    derivedUrlEndsWith?: string;
  };
};

const cases: SmokeCase[] = [
  {
    name: "loos-cable",
    companyName: "Loos & Co.",
    websiteUrl: "https://loosco.com/",
    expect: {
      minWebsiteChars: 1000,
      minCodes: 1,
      codeMatches: [/cable|wire rope|rope|rigging|aircraft/i],
    },
  },
  {
    name: "hr-parts-sheetmetal",
    companyName: "H&R Parts Co., Inc.",
    websiteUrl: "https://www.hrpartsco.com/",
    expect: {
      minWebsiteChars: 500,
      minCodes: 1,
      codeMatches: [/aircraft|airframe|sheet|metal|structural/i],
    },
  },
  {
    name: "pdf-plumbing",
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
  {
    name: "broken-url-graceful",
    companyName: "Nowhere LLC",
    websiteUrl: "https://definitely-not-a-real-host-6d8e2a.invalid/",
    description: "Industrial widget manufacturer for verification.",
    expect: {
      websiteErrorLike: /ENOTFOUND|getaddrinfo|fetch failed|unknown/i,
    },
  },
  {
    name: "email-derived-url",
    companyName: "Loos (email-derived)",
    email: "sales@loosco.com",
    expect: {
      derivedUrlEndsWith: "loosco.com",
      minWebsiteChars: 500,
      codeMatches: [/cable|wire|rope|aircraft/i],
    },
  },
];

function fixturePath(name: string): string {
  return resolve(fixturesDir, `${name}.json`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchLive(c: SmokeCase): Promise<ClassifyBody | null> {
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
    return null;
  }
  return (await res.json()) as ClassifyBody;
}

async function loadFixture(c: SmokeCase): Promise<ClassifyBody | null> {
  const path = fixturePath(c.name);
  if (!(await exists(path))) return null;
  return JSON.parse(await readFile(path, "utf8")) as ClassifyBody;
}

async function saveFixture(c: SmokeCase, body: ClassifyBody): Promise<void> {
  await mkdir(fixturesDir, { recursive: true });
  await writeFile(fixturePath(c.name), JSON.stringify(body, null, 2));
}

function assertCase(c: SmokeCase, body: ClassifyBody): string[] {
  const failures: string[] = [];

  if (body.companyName !== c.companyName) failures.push(`companyName=${body.companyName}`);
  if (!Array.isArray(body.codes)) failures.push("codes not array");

  const webChars = body.sources?.website?.chars ?? 0;
  const pdfChars = body.sources?.pdf?.chars ?? 0;
  const webError = body.sources?.website?.error;
  const derivedUrl = body.sources?.email?.derivedUrl;

  if (c.expect.minWebsiteChars && webChars < c.expect.minWebsiteChars) {
    failures.push(`website chars ${webChars} < ${c.expect.minWebsiteChars} (error=${webError ?? "none"})`);
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
  if (c.expect.websiteErrorLike) {
    if (body.sources?.website?.ok) failures.push(`expected website scrape to fail, got ok=${webChars}ch`);
    else if (!webError || !c.expect.websiteErrorLike.test(webError)) {
      failures.push(`website error "${webError ?? "(none)"}" does not match ${c.expect.websiteErrorLike}`);
    }
  }
  if (c.expect.derivedUrlEndsWith) {
    if (!derivedUrl || !derivedUrl.endsWith(c.expect.derivedUrlEndsWith)) {
      failures.push(`derivedUrl=${derivedUrl ?? "(none)"} does not end with ${c.expect.derivedUrlEndsWith}`);
    }
  }
  return failures;
}

async function runOne(c: SmokeCase): Promise<"pass" | "fail" | "skip"> {
  if (c.pdfPath && c.skipIfPdfMissing) {
    try {
      await stat(c.pdfPath);
    } catch {
      console.log(`[smoke] ${c.name} SKIP — ${c.pdfPath} not present`);
      return "skip";
    }
  }

  let body: ClassifyBody | null;
  let source: "fixture" | "live";

  if (OFFLINE) {
    body = await loadFixture(c);
    source = "fixture";
    if (!body) {
      console.log(`[smoke] ${c.name} SKIP — offline mode, no fixture at ${fixturePath(c.name)}`);
      return "skip";
    }
  } else {
    body = await fetchLive(c);
    source = "live";
    if (!body) return "fail";
    if (RECORD || !(await exists(fixturePath(c.name)))) {
      await saveFixture(c, body);
    }
  }

  const failures = assertCase(c, body);

  const webChars = body.sources?.website?.chars ?? 0;
  const pdfChars = body.sources?.pdf?.chars ?? 0;
  const derivedUrl = body.sources?.email?.derivedUrl;
  const webError = body.sources?.website?.error;
  const descList = body.codes?.map((k) => `${k.code}:${k.description} (${k.confidence})`).join(", ");

  console.log(
    `[smoke] ${c.name} ${failures.length ? "FAIL" : "OK"} [${source}] — web=${webChars}ch pdf=${pdfChars}ch codes=${body.codes?.length ?? 0}${derivedUrl ? ` derived=${derivedUrl}` : ""}`,
  );
  if (descList) console.log(`[smoke]   ${descList}`);
  if (webError && !body.sources?.website?.ok) console.log(`[smoke]   website error: ${webError}`);
  if (failures.length) console.log(`[smoke]   failures: ${failures.join("; ")}`);
  return failures.length === 0 ? "pass" : "fail";
}

async function main() {
  console.log(`[smoke] mode=${OFFLINE ? "OFFLINE (fixtures)" : "LIVE"}${RECORD ? " +RECORD" : ""}`);
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
