# FSC Classifier

Classifies a company against the U.S. Federal Supply Classification (FSC)
system. Given a company name plus any combination of a website URL, contact
email, capability-statement PDF, and free-text description, the service
returns a ranked list of 4-digit FSC codes with confidence, reasoning, and
a verbatim evidence quote for each match.

Built in a single time-boxed session as a take-home for SalesPatriot.

Live repo: <https://github.com/nickw409/fsc-classifier>

---

## Setup

### Requirements

- Node 20+
- An OpenRouter API key (Sonnet 4.6 access): <https://openrouter.ai/>

### Install

```bash
git clone https://github.com/nickw409/fsc-classifier.git
cd fsc-classifier
cp .env.example .env    # then paste your key
# .env contents:
# OPENROUTER_API_KEY=sk-or-...

cd server && npm install
cd ../web  && npm install
```

### Run

Two terminals:

```bash
# terminal 1 — API server on :3000
cd server
npm run dev

# terminal 2 — Vite dev on :5173 (proxies /api/* → :3000)
cd web
npm run dev
```

Then open <http://localhost:5173>.

### Smoke tests

```bash
cd server
npm run smoke                 # live end-to-end, 6 cases, ~$0.05–$0.15 per run
SMOKE_OFFLINE=1 npm run smoke # replay from fixtures, $0.00
SMOKE_RECORD=1  npm run smoke # overwrite existing fixtures
npm run scrape:check -- https://example.com/  # scrape-only sanity tool
npm test                      # parser unit tests
```

Offline mode replays the cached responses in `server/fixtures/*.json` so CI
or teammates can run the assertion suite without an API key.

---

## Architecture

```
 browser  ──► Vite dev server :5173 ──► Express :3000
   │                                       │
   │ multipart POST /api/classify          ├─ scrape.ts   (cheerio + undici)
   │                                       ├─ pdf.ts      (pdf-parse)
   │                                       ├─ prompt.ts   (splits static prefix /
   │                                       │               dynamic suffix)
   │                                       ├─ classify.ts (OpenRouter → Sonnet 4.6
   │                                       │               with prompt caching)
   │                                       ├─ parser.ts   (fence-strip + shape check)
   │                                       └─ fsc.ts      (hydrates code → description,
   │                                                       group, group_name)
   ▼
 renders grouped code cards with confidence + evidence
```

### Pipeline

Inputs converge into one LLM call:

1. **Website URL → scrape.** Native `fetch` via `undici`, browser UA,
   10 s abort timeout. On TLS cert errors (H&R Parts has an expired cert),
   retry with `rejectUnauthorized: false`. On connection errors, fall back
   to `http://`. `cheerio` strips `script/style/nav/footer/aside/iframe/svg`,
   prefers `<main>`/`<article>`, collapses whitespace, slices to 8 KB.
2. **PDF → text.** `pdf-parse` on in-memory `multer` buffer (10 MB limit),
   capped at 20 KB.
3. **Email → derived URL.** If no website was given, split on `@`, reject
   consumer providers (gmail / yahoo / outlook / hotmail / aol / protonmail
   / icloud / etc.), and scrape `https://<domain>` as if it were the website.
4. **Description.** Passed through verbatim.
5. **Classify.** `prompt.ts` builds a two-part prompt: a static prefix
   (role instructions + full 580-code FSC list + output schema) and a
   dynamic suffix (company name + inputs). `classify.ts` sends both as
   separate content blocks to OpenRouter with `cache_control: ephemeral`
   on the prefix. Anthropic's prompt caching hits on every call after the
   first within a 5-minute window.
6. **Parse + hydrate.** `parser.ts` strips markdown fences and preamble/
   trailing prose, extracts the JSON object, validates shape. The LLM
   returns only `{ code, confidence, reasoning, evidence }`; the server
   hydrates each entry with `description`, `group_code`, `group_name`
   from `fsc_codes.json`. Hallucinated codes (not in the list) are
   dropped and logged — **hallucinated descriptions are impossible by
   construction.**

### Response shape

```ts
type ClassifyResponse = {
  companyName: string;
  analysis: string;           // one-sentence company summary
  sources: {                  // what the server actually used
    website:     { ok; chars; error? };
    pdf:         { ok; chars; error? };
    description: { ok; chars };
    email:       { ok; chars; derivedUrl?; error? };
  };
  codes: Array<{
    code: string;             // 4-digit
    description: string;      // from fsc_codes.json
    group_code: string;       // 2-digit FSG
    group_name: string;       // from fsc_codes.json
    confidence: "high" | "medium" | "low";
    reasoning: string;
    evidence: string;         // verbatim substring of the inputs
  }>;
};
```

`?debug=1` adds `rawLLMResponse` to the body for troubleshooting.

### Frontend

Single page. React 18 + Tailwind. Form fields for name / URL / email /
description / PDF. Results render as **FSG-grouped code cards** sorted
primarily by the group's best-confidence member, secondarily by code
number inside each group. Confidence pills: emerald / amber / rose. Each
code shows reasoning plus the verbatim evidence quote in an italic
blockquote with a slate left border. Source badges up top show what the
server actually used (emerald = ok, amber = error, slate = empty). A
spinner with a time-based stage label ("Fetching website…" →
"Classifying with Claude…") covers latency.

---

## Measured behavior

Per-company timings, captured in the [timing] log line, with prompt
caching warm:

| Case (live) | Scrape | Classify | Total | Cached tokens |
|---|---:|---:|---:|---:|
| Loos (URL) | 250 ms | 10.2 s | 10.5 s | 10,564 |
| H&R Parts (URL + SSL bypass) | 812 ms | 6.4 s | 7.2 s | 10,564 |
| LSDP (PDF only) | 272 ms | 12.5 s | 12.8 s | 10,564 |
| PDF only (large) | 272 ms | 8.5 s | 8.8 s | 10,564 |
| Broken URL + description | 120 ms | 5.7 s | 5.8 s | 10,564 |
| Email-derived URL | 137 ms | 10.6 s | 10.7 s | 10,564 |

Cold (cache miss, first call of a 5-minute window) adds ~3–5 s to the
classify time. Every subsequent call within the window skips
re-processing the 10.5 K-token FSC prefix.

OpenRouter cost per call: ~$0.036 input × ~10% for cached + ~$0.012
output ≈ **$0.016 per cached call**, $0.048 on a cold call.

---

## Tradeoffs taken

- **One big prompt, not a two-pass pipeline.** The full 580-code FSC
  list fits easily in Sonnet's context. A two-pass (group → code)
  pipeline would double latency and double cost without a measurable
  quality win at this size. With more codes this would change.
- **No hallucinated descriptions — ever.** The LLM is allowed to
  invent a 4-digit code but never its description. The server drops
  any code not in `fsc_codes.json` at hydration time. This is a hard
  constraint by construction, not a runtime check.
- **Single LLM call per request.** No self-critique pass, no rejected-
  codes pass, no retry on LLM errors. Surfaces the error instead.
  Simpler to reason about and saves ~$0.05 per classification.
- **Browser-shaped `fetch` over a formal scraper.** Undici with a
  Chrome UA passes most bot checks (Loos & Co. sits behind Cloudflare;
  `curl` gets a 403 challenge page, undici gets the real HTML). No
  JS-rendering fallback; a headless browser would handle more sites
  but multiplies resource cost.
- **Cert bypass as a retry, not a default.** Strict TLS first; only
  after a cert failure do we retry with `rejectUnauthorized: false`.
  Live-correct certs (every other site) go through the normal path.
- **Static prefix cached, not the LLM response.** Prompt caching saves
  ~3–5 s and ~$0.03 on repeat calls. Response caching would hide model
  drift and is forbidden by the spec anyway.
- **No state.** No database, no session, no result history. Refresh
  clears the UI. Matches the assignment's "simplest thing that works"
  directive.
- **`description` is a first-class fallback.** When URL and PDF both
  fail (the "Nowhere LLC" case), the description carries the request
  through — the user pastes a sentence, classification still runs.
- **Shared types kept in sync manually.** `server/src/types.ts` and
  `web/src/types.ts` are duplicated. A tsconfig project-reference or
  a shared package would be correct; at this size the duplication is
  cheaper.

## What I'd build next (production considerations)

- **Persistence.** Classifications today vanish on refresh. A
  `classifications` table keyed on `(companyName, normalizedUrl, pdfHash)`
  plus a 7-day cache would eliminate 80%+ of repeat spend.
- **Human review loop.** Confidence is the model's self-report. A
  thumbs-up/down on each code, stored against the request, gives a
  ground-truth set to fine-tune the prompt against.
- **Two-pass classification** if the FSC list grows. First call picks
  FSGs (groups); second call picks 4-digit codes within the hit
  groups. Roughly halves the per-call input token count for companies
  that cleanly fit 2–3 groups.
- **Self-critique pass.** Ask the model to re-read its own evidence
  quotes against the source text and drop codes whose evidence no
  longer substantiates the match. Catches the occasional "low" that
  was actually a confabulation. Adds one more LLM call per request.
- **Streaming LLM output.** Server-sent events with partial-JSON
  parsing; show codes as they arrive. Perceived latency drops from 8–15 s
  to ~1 s.
- **Scraper upgrades.** Playwright for JS-heavy sites; sitemap crawl
  for companies that put real content on a `/products` sub-page; FAQ
  and About page discovery for sparse homepages.
- **Rate limit + usage metering.** Anthropic caching means a loose
  rate limit is safer than it looks, but uncached tokens still cost
  real money; per-IP and per-key quotas are table stakes.
- **CI.** Running the offline smoke in GitHub Actions on every PR
  would catch assertion regressions with zero API cost.
- **Structured provider logging** (instead of `console.log`).

---

## File map

```
.
├── data/
│   ├── AV_FSCClassAssignment._151007.pdf  # assignment source doc
│   └── fsc_codes.json                     # 580 entries, validated at boot
├── server/
│   ├── src/
│   │   ├── index.ts      # Express app, route wiring, dotenv bootstrap
│   │   ├── scrape.ts     # undici fetch + cheerio + SSL/HTTP fallbacks
│   │   ├── pdf.ts        # pdf-parse wrapper
│   │   ├── prompt.ts     # two-part prompt (static prefix / dynamic suffix)
│   │   ├── classify.ts   # OpenRouter call with prompt caching
│   │   ├── parser.ts     # LLM-response JSON extraction
│   │   ├── fsc.ts        # FSC loader + validator + lookup
│   │   ├── email.ts      # consumer blocklist + domain → URL
│   │   └── types.ts
│   ├── fixtures/         # cached smoke responses (committed)
│   └── tests/
│       ├── parser.test.ts
│       ├── smoke.ts      # end-to-end, live or offline-replay
│       └── scrape_check.ts
└── web/
    └── src/
        ├── App.tsx
        ├── api.ts
        ├── types.ts
        └── components/
            ├── CompanyForm.tsx
            ├── LoadingIndicator.tsx
            └── ResultsDisplay.tsx
```

---

## Known limits

- Cloudflare challenges: undici's fingerprint bypasses most gates, but
  not all. A site that actively challenges undici will return a short
  block-page body; the `scrape:check` tool flags this as a ratio/size
  failure. No headless-browser fallback.
- PDFs with OCR-only content (scanned, no text layer) parse to empty.
  `pdf-parse` does not OCR.
- `?debug=1` returns the raw LLM response and is enabled unconditionally.
  In production it would be gated behind auth.
- The in-process FSC list means a server restart is needed to update
  codes. Fine for this scope.
