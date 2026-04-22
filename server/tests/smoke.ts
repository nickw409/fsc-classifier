// Smoke test — hits the live /api/classify endpoint with a multipart POST.
// Usage: ensure `npm run dev` is running in another terminal, then `npm run smoke`.

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

type FscCode = {
  code: string;
  description: string;
  group_code: string;
  group_name: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  evidence: string;
};

type ClassifyBody = {
  companyName?: string;
  analysis?: string;
  sources?: {
    website?: { ok: boolean; chars: number; error?: string };
  };
  codes?: FscCode[];
};

type SmokeCase = {
  name: string;
  companyName: string;
  websiteUrl?: string;
  email?: string;
  description?: string;
  expect: {
    minWebsiteChars?: number;
    minCodes?: number;
    codeMatches?: RegExp[]; // at least one hydrated code description must match each regex
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
];

async function runOne(c: SmokeCase): Promise<boolean> {
  const fd = new FormData();
  fd.set("companyName", c.companyName);
  if (c.websiteUrl) fd.set("websiteUrl", c.websiteUrl);
  if (c.email) fd.set("email", c.email);
  if (c.description) fd.set("description", c.description);

  const res = await fetch(`${BASE}/api/classify`, { method: "POST", body: fd });
  if (!res.ok) {
    console.error(`[smoke] ${c.name} HTTP ${res.status}: ${await res.text()}`);
    return false;
  }
  const body = (await res.json()) as ClassifyBody;
  const failures: string[] = [];

  if (body.companyName !== c.companyName) failures.push(`companyName=${body.companyName}`);
  if (!Array.isArray(body.codes)) failures.push("codes not array");

  const webChars = body.sources?.website?.chars ?? 0;
  if (c.expect.minWebsiteChars && webChars < c.expect.minWebsiteChars) {
    failures.push(`website chars ${webChars} < ${c.expect.minWebsiteChars} (error=${body.sources?.website?.error ?? "none"})`);
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
    `[smoke] ${c.name} ${failures.length ? "FAIL" : "OK"} — web=${webChars}ch codes=${body.codes?.length ?? 0}`,
  );
  if (descList) console.log(`[smoke]   ${descList}`);
  if (failures.length) console.log(`[smoke]   failures: ${failures.join("; ")}`);
  return failures.length === 0;
}

async function main() {
  let pass = 0;
  for (const c of cases) {
    if (await runOne(c)) pass++;
  }
  console.log(`[smoke] ${pass}/${cases.length} passed`);
  process.exit(pass === cases.length ? 0 : 1);
}

main().catch((e) => {
  console.error("[smoke] crashed:", e);
  process.exit(1);
});
