// Scrape verification tool.
// Usage: npm run scrape:check -- <url> [<url> ...]
// Or:    npx tsx tests/scrape_check.ts https://example.com/
//
// Runs the same fetch+extract path the classifier uses, then asserts
// site-agnostic sanity checks. Exits non-zero if any URL fails any check.
// Use this to verify scrape.ts is pulling real content — not a Cloudflare
// challenge page, not an empty shell, not a nav/footer-only extraction.

import { extractText } from "../src/scrape.js";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CHECKS = {
  MIN_RAW_BYTES: 5_000,       // anything smaller is likely a bot-block / error page
  MIN_CLEAN_CHARS: 500,       // any real company homepage has >500 chars of prose
  MIN_RATIO: 0.002,           // <0.2% extracted = we probably stripped the content
  MAX_RATIO: 0.5,             // >50% extracted = probably leaking scripts/styles
};

type Check = { name: string; pass: boolean; detail: string };

async function inspect(url: string): Promise<{ url: string; ok: boolean; checks: Check[] }> {
  const checks: Check[] = [];
  let html = "";
  let http = 0;

  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      redirect: "follow",
    });
    http = res.status;
    html = await res.text();
  } catch (e) {
    return {
      url,
      ok: false,
      checks: [{ name: "fetch", pass: false, detail: (e as Error).message }],
    };
  }

  const cleaned = extractText(html);
  const ratio = html.length ? cleaned.length / html.length : 0;

  checks.push({ name: "HTTP 200", pass: http === 200, detail: `status=${http}` });
  checks.push({
    name: `raw HTML ≥ ${CHECKS.MIN_RAW_BYTES}B`,
    pass: html.length >= CHECKS.MIN_RAW_BYTES,
    detail: `${html.length} bytes`,
  });
  checks.push({
    name: `cleaned text ≥ ${CHECKS.MIN_CLEAN_CHARS} chars`,
    pass: cleaned.length >= CHECKS.MIN_CLEAN_CHARS,
    detail: `${cleaned.length} chars`,
  });
  checks.push({
    name: `ratio in [${CHECKS.MIN_RATIO}, ${CHECKS.MAX_RATIO}]`,
    pass: ratio >= CHECKS.MIN_RATIO && ratio <= CHECKS.MAX_RATIO,
    detail: `ratio=${ratio.toFixed(4)}`,
  });

  const ok = checks.every((c) => c.pass);
  return { url, ok, checks };
}

function preview(text: string, n = 200): string {
  return text.replace(/\s+/g, " ").slice(0, n);
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
    if (r.ok) {
      // Show a preview so you can eyeball that it's real content, not nav boilerplate.
      try {
        const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
        const html = await res.text();
        const sample = extractText(html);
        console.log(`  preview: "${preview(sample)}…"`);
      } catch {
        /* ignore */
      }
    } else {
      failed++;
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("[check] crashed:", e);
  process.exit(1);
});
