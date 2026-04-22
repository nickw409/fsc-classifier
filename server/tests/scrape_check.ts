// Scrape verification tool.
// Usage: npm run scrape:check -- <url> [<url> ...]
// Or:    npx tsx tests/scrape_check.ts https://example.com/
//
// Runs the production scrape() pipeline (with all retries/fallbacks) and
// asserts site-agnostic sanity checks. Exits non-zero if any URL fails.
// Use this to verify scrape.ts is pulling real content — not a bot-challenge
// page, not an empty shell, not a nav/footer-only extraction.

import { scrape } from "../src/scrape.js";

const CHECKS = {
  MIN_CLEAN_CHARS: 500,
};

type Check = { name: string; pass: boolean; detail: string };

async function inspect(url: string): Promise<{ url: string; ok: boolean; checks: Check[]; preview: string }> {
  const r = await scrape(url);

  const checks: Check[] = [
    { name: "scrape.ok", pass: r.ok, detail: r.ok ? "ok" : `error=${r.error ?? "unknown"}` },
    {
      name: `cleaned text ≥ ${CHECKS.MIN_CLEAN_CHARS} chars`,
      pass: r.chars >= CHECKS.MIN_CLEAN_CHARS,
      detail: `${r.chars} chars`,
    },
  ];
  const ok = checks.every((c) => c.pass);
  const preview = r.text.replace(/\s+/g, " ").slice(0, 200);
  return { url, ok, checks, preview };
}

async function main() {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error("usage: scrape_check.ts <url> [<url> ...]");
    process.exit(2);
  }

  let failed = 0;
  for (const url of urls) {
    const r = await inspect(url);
    console.log(`\n[check] ${url} — ${r.ok ? "PASS" : "FAIL"}`);
    for (const c of r.checks) {
      console.log(`  ${c.pass ? "✓" : "✗"} ${c.name}: ${c.detail}`);
    }
    if (r.ok && r.preview) console.log(`  preview: "${r.preview}…"`);
    if (!r.ok) failed++;
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("[check] crashed:", e);
  process.exit(1);
});
