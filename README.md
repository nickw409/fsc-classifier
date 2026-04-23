# FSC Classifier

Classifies a company against the U.S. Federal Supply Classification (FSC)
system. Given a company name plus any combination of a website URL, contact
email, capability-statement PDF, and free-text description, the service
returns a ranked list of 4-digit FSC codes with confidence, reasoning, and
a verbatim evidence quote for each match.

Live repo: <https://github.com/nickw409/fsc-classifier>

---

## For reviewers

The README is comprehensive; if you're short on time:

- **5 minutes:** skim the Tradeoffs and Validation run sections, then load
  the app and classify Loos & Co (`https://loosco.com/`).
- **15 minutes:** add What I'd build next and Measured behavior. Run the
  offline smoke to replay the six validation cases without an API key:
  ```bash
  cd server && SMOKE_OFFLINE=1 npm run smoke
  ```
- **30 minutes:** add a live classification against a company of your
  choice (the 4th test case) plus the scrape sanity tool:
  ```bash
  cd server && npm run scrape:check -- https://<url>
  ```

Three sections are the strongest signal on engineering judgment:
**Tradeoffs taken**, **Validation run** (especially the FSG 34
calibration observation and the non-defense edge case), and
**What I'd build next**.

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

### Test data

The three assignment companies (Loos & Co., H&R Parts, LSDP) are encoded
in the smoke suite — the LSDP capability statement PDF ships in
`server/fixtures/` for offline replay. For live classification the URL
for Loos and H&R is entered via the form; for LSDP, drop the capability
statement PDF directly into the form's upload zone.

Alternative: `npm run dev:bg` (background the server via `setsid` + pidfile;
`dev:stop` / `dev:restart` / `dev:status` / `dev:log` round out the loop).
See [server/scripts/dev-bg.sh](server/scripts/dev-bg.sh).

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

React 18 + Vite + Tailwind with IBM Plex Sans/Mono. Layout is a fixed
260 px sidebar (brand, new-classification button, history search, recent
list, theme toggle) alongside an 880 px main column that swaps between
form / loading / result / error / no-codes views.

Design system: OKLCH design tokens (`--bg`, `--ink-{1-4}`, `--accent`,
semantic `--ok/warn/err` triples, `--border-strong`) on `:root` and
`[data-theme="dark"]`. Tailwind resolves them via CSS variables so every
color in the app reduces to a token — no raw slate/gray/blue classes
remain in `web/src/components/`. `useTheme` persists the light/dark
choice in `localStorage` and flips `data-theme` on `<html>`.

**Form.** URL + email share a row with live validation (regex + HTML5
`type=url|email`; field turns rose-bordered, inline hint, submit disables
until clean). PDF dropzone is a dashed-border target that accepts both
drag-and-drop and click-to-browse, with a selected-file pill showing name
/ size / X-to-clear. URL field's native bot-block fallback is handled
server-side, not flagged in the UI. Submit shows "Company name is
required" only after a submit attempt — not on first render.

**Results.** Analysis card → 5-cell stats strip (Total / High / Medium /
Low / Groups, mono big-number) → SortBar (six sort keys: best match,
confidence, code ↑/↓, FSG, A–Z; grouped vs. flat swap by key) → Copy as
CSV → either grouped `GroupSection` list (collapsible FSG headers with
mono badge + count) or flat card list. Each `CodeCard` shows the code in
a mono badge box + description + confidence pill (dot + uppercase label)
+ inline copy button, then reasoning, then a verbatim evidence quote as a
blockquote with an accent-colored left border.

**Submitted bar.** When a classification completes, a compact summary bar
sits above the results: monogram tile + company name + codes-count, then
the four source badges (Website / PDF / Desc / Email with icons), then
Re-run and "New" action buttons.

**Loading state.** 14 px spinner + "Classifying {company}…" + elapsed
seconds, shimmer progress bar, and three stage cards (Fetching inputs →
Building prompt → Classifying) with done/active/pending indicators. The
server doesn't stream progress — stages are time-based approximations.

**History.** Every completed classification is stored (response + meta)
in `localStorage` under `fsc.history.v1` (capped at 50). Clicking an
entry re-opens the cached result instantly with no API call. Search
filters by company name and URL. Clear-all button in the footer.

**Keyboard.** `⌘K` / `Ctrl-K` (platform-detected label in the sidebar)
clears state and focuses the name input.

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

## Validation run

Beyond the three assignment companies (Loos & Co., H&R Parts, LSDP), I
ran six additional cases to probe domain discrimination, platform-context
extraction, and over-classification on non-defense companies:

- **Machining / aerospace:** GS Precision, Acutec Precision Aerospace,
  W Machine Works (which mentions M230 Cannon / F-35 / Apache by name).
- **Electronics focus:** Sechan Electronics, Ace Electronics Defense Systems.
- **Non-defense edge case:** Levain Bakery.

All six passed the rubric qualitatively. Headlines:

- **No over-classification on non-defense.** The bakery returned one
  tightly-scoped code (8920 Bakery and Cereal Products). No defense codes,
  no lazy defaults — the failure mode we cared most about did not trigger.
- **Platform-context extraction works.** W Machine Works correctly
  surfaced **1005 Guns thru 30 mm** from the M230 Cannon mention and
  **1420 Guided Missile Components** from the programs list. The classifier
  reads stated programs, not just surface capabilities.
- **Domain discrimination is clean.** Sechan and Ace Electronics returned
  FSG 58/59 electronics codes only — **zero machining codes**, despite
  being defense contractors with manufacturing operations.

Two calibration observations worth knowing about:

1. **FSG 34 (Metalworking Machinery) service-vs-product conflation.**
   The codes in FSG 34 describe the *machines themselves* — lathes,
   milling machines, machining centers as products purchased by the
   government. Contract machine shops that *use* these machines to
   fabricate parts should normally classify to the parts they sell
   (FSG 15/16/28), not FSG 34. The classifier handled this inconsistently
   across three similar shops: GS Precision returned 3408 at *low*
   confidence with honest "operates machining centers" reasoning;
   Acutec and W Machine returned 3408 at *high* with similar evidence
   shape. Calibration drift, not correctness — all three are defensible
   against the evidence cited, just not aligned with each other.
2. **Sparse-scrape name-fallback.** When a target website is JS-rendered
   and the scrape returns very little content (the Tartine test case
   returned ~20 chars), the classifier still emits a medium-confidence
   code inferred from the company name alone. The UI's source badge
   surfaces the char count, so the reader can spot a thin scrape — but
   the prompt could plausibly be tightened to downgrade confidence when
   all inputs combined are below a threshold.
3. **Rerun variance on borderline codes.** `classify.ts` doesn't set a
   `temperature` on the OpenRouter request, so Sonnet samples at its
   default (1.0). Two back-to-back runs on the same company usually
   produce the same 5–8 core codes but can differ by ±1 on borderline
   entries: a code whose inclusion probability sits near the model's
   internal threshold (call it 65 %) shows up on ~65 % of runs and not
   on the rest. Prompt caching doesn't affect this — the cache is
   input-side; output generation still samples token-by-token. Leaving
   it at default has one upside: back-to-back runs are effectively an
   ensemble and can surface coverage you might otherwise miss. A one-
   line fix (`temperature: 0`) would tighten this to near-deterministic
   at the cost of slightly flatter reasoning prose; worth doing if
   perfect reproducibility becomes more important than coverage.

None blocks the demo; all are filed in the follow-ups list below.

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
- **Client-only persistence.** No database. History is in `localStorage`
  on the browser — good enough for a demo on a single machine, zero
  deploy/infra overhead. Matches the assignment's "simplest thing that
  works" directive; server-side persistence is called out in the
  production-considerations list below.
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
- **Calibrate FSG 34 in the prompt.** Add an explicit rule that FSG 34
  codes describe machines as products, so contract machining services
  should classify to what they *produce* (FSG 15/16/28) rather than the
  machinery category. Resolves the validation-run inconsistency above.
- **Downgrade confidence on thin inputs.** When combined scraped +
  PDF + description chars are below a threshold (say, 200), cap
  confidence at "low" for all returned codes. Resolves the sparse-scrape
  fallback where a JS-rendered site yields name-only inference at
  medium confidence.
- **Pin temperature (or expose it).** Setting `temperature: 0` on the
  OpenRouter call removes the borderline-code jitter documented in the
  validation section. Would keep as a config so a "diverse coverage"
  mode stays available.

---

## File map

```
.
├── data/
│   ├── AV_FSCClassAssignment._151007.pdf  # assignment source doc
│   └── fsc_codes.json                     # 580 entries, validated at boot
├── design-reference.html                  # Claude-generated prototype used
│                                          #   as the frontend polish target
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
│   ├── scripts/
│   │   └── dev-bg.sh     # background-server control (setsid + pidfile)
│   └── tests/
│       ├── parser.test.ts
│       ├── smoke.ts      # end-to-end, live or offline-replay
│       └── scrape_check.ts
└── web/
    └── src/
        ├── App.tsx
        ├── api.ts
        ├── index.css     # design tokens (OKLCH) + utilities
        ├── types.ts
        ├── hooks/
        │   ├── useTheme.ts     # light/dark, localStorage
        │   └── useHistory.ts   # classifications history, localStorage
        └── components/
            ├── Sidebar.tsx         # brand, new, search, history list, footer
            ├── MainHeader.tsx      # per-state kicker / title / sub
            ├── CompanyForm.tsx     # form + drag-drop PDF + validation
            ├── SubmittedBar.tsx    # monogram + source badges + re-run/new
            ├── LoadingIndicator.tsx # spinner + shimmer + 3-stage cards
            └── ResultsDisplay.tsx  # analysis, stats, sort, groups, CSV
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