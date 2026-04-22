// Smoke test — hits the live /api/classify endpoint with a multipart POST.
// Usage: ensure `npm run dev` is running in another terminal, then `npm run smoke`.

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

type SmokeCase = {
  name: string;
  companyName: string;
  websiteUrl?: string;
  email?: string;
  description?: string;
};

const cases: SmokeCase[] = [
  { name: "stub-roundtrip", companyName: "Acme Test Co", description: "placeholder input for stub phase" },
];

async function runOne(c: SmokeCase): Promise<boolean> {
  const fd = new FormData();
  fd.set("companyName", c.companyName);
  if (c.websiteUrl) fd.set("websiteUrl", c.websiteUrl);
  if (c.email) fd.set("email", c.email);
  if (c.description) fd.set("description", c.description);

  const res = await fetch(`${BASE}/api/classify`, { method: "POST", body: fd });
  if (!res.ok) {
    console.error(`[smoke] ${c.name} HTTP ${res.status}`);
    return false;
  }
  const body = (await res.json()) as { companyName?: string; codes?: unknown[] };
  const ok = body.companyName === c.companyName && Array.isArray(body.codes);
  console.log(`[smoke] ${c.name} ${ok ? "OK" : "FAIL"} — codes=${body.codes?.length ?? "?"}`);
  return ok;
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
