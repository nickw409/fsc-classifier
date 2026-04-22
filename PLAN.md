# FSC Code Classifier — Build Plan

## Context

Take-home for SalesPatriot final-round interview. Per the interviewer, the 4-hour timer starts at `git init` / initial commit. AI assistance allowed (Claude Code).

Evaluation axes per spec: problem-solving, creativity, prototyping speed, communication. MVP over polish. The spec is explicit about this twice.

## Stack

- **Backend:** Node + Express + TypeScript, run via `tsx`
- **Frontend:** Vite + React + TypeScript + Tailwind
- **Monorepo layout:** sibling `server/` and `web/` directories, separate `package.json`s
- **LLM:** OpenRouter → `anthropic/claude-sonnet-4.6`
- **PDF parsing:** `pdf-parse`
- **File upload:** `multer` (in-memory)
- **Scraping:** native `fetch` + regex HTML stripping

Stack matches SalesPatriot's hiring stack (TS + frontend framework is a hard filter in their job posting).

## Directory Layout

```
/
├── PLAN.md                  # this file
├── CLAUDE.md                # instructions for Claude Code
├── README.md                # writeup, architecture, tradeoffs
├── .env.example             # OPENROUTER_API_KEY=
├── .env                     # gitignored, real key
├── data/
│   ├── AV_FSCClassAssignment.pdf
│   └── fsc_codes.json       # 580 entries, LLM-extracted, spot-checked
├── server/
│   ├── src/
│   │   ├── index.ts         # express app + route wiring
│   │   ├── scrape.ts        # url → { ok, text, error }
│   │   ├── pdf.ts           # buffer → { ok, text, error }
│   │   ├── classify.ts      # (text, name) → { analysis, codes }
│   │   ├── fsc.ts           # load + validate fsc_codes.json
│   │   ├── prompt.ts        # build LLM prompt
│   │   ├── parser.ts        # LLM response → JSON
│   │   └── types.ts
│   ├── fixtures/            # cached scrapes + LLM responses for offline testing
│   └── tests/
│       ├── parser.test.ts
│       └── smoke.ts
└── web/
    └── src/
        ├── App.tsx
        ├── api.ts
        ├── types.ts         # copy of server types
        └── components/
            ├── CompanyForm.tsx
            └── ResultsDisplay.tsx
```

## API Contract

```ts
// POST /api/classify (multipart/form-data)
// Fields: companyName, websiteUrl?, email?, description?, pdf? (file)

type SourceStatus = {
  ok: boolean;
  chars: number;
  error?: string;
};

type FscCode = {
  code: string;           // 4-digit
  description: string;    // hydrated from fsc_codes.json
  group_code: string;     // hydrated
  group_name: string;     // hydrated
  confidence: "high" | "medium" | "low";
  reasoning: string;
  evidence: string;
};

type ClassifyResponse = {
  companyName: string;
  analysis: string;
  sources: {
    website: SourceStatus;
    pdf: SourceStatus;
    description: SourceStatus;
    email: SourceStatus & { derivedUrl?: string };
  };
  codes: FscCode[];
  rawLLMResponse?: string;  // when ?debug=1
};
```

The LLM returns only `{code, confidence, reasoning, evidence}`. The server
looks up `description`, `group_code`, `group_name` from `fsc_codes.json` and
hydrates the final response. This keeps the prompt smaller and makes
hallucinated descriptions impossible.

## Input Handling

Four input paths converge into one text blob for the classifier:

1. **`websiteUrl` provided** → scrape directly
2. **`websiteUrl` not provided but `email` provided** → derive URL from email domain (strip user, prepend `https://`), scrape that
3. **Scrape fails OR no URL at all** → keep email domain as a weak text signal
4. **`pdf` uploaded** → extract text
5. **`description` provided** → use as text

All successful extractions concatenate with labeled sections (`--- WEBSITE CONTENT ---`, `--- UPLOADED DOCUMENT ---`, `--- USER DESCRIPTION ---`, `--- CONTACT EMAIL ---`).

Consumer email providers (gmail, yahoo, outlook, hotmail, aol, protonmail) are blocklisted — don't derive URLs from them, don't pass them as signal.

## LLM Prompt

```
You are classifying a company against the U.S. Federal Supply Classification
(FSC) system used by the U.S. government for procurement.

COMPANY NAME: {name}

INPUTS (use all that are present):

--- WEBSITE CONTENT ---
{website_text_or_"(unavailable)"}

--- UPLOADED DOCUMENT ---
{pdf_text_or_"(none)"}

--- USER DESCRIPTION ---
{description_or_"(none)"}

--- CONTACT EMAIL ---
{email_or_"(none)"}
(Company email domain may hint at industry or parent organization; weight lightly.)

--- FSC CODE LIST ---
{json_array_of_all_580_codes}

TASK

1. Determine what this company makes, sells, or provides.
2. Select ALL FSC codes that describe their offerings.
3. For each code, provide:
   - code: 4-digit FSC code (string, zero-padded)
   - confidence: "high" | "medium" | "low"
   - reasoning: one sentence explaining the match
   - evidence: a direct quote from the inputs above supporting the match

RULES

- Prefer precision over recall. Only include a code if you can cite specific evidence.
- If inputs contain NAICS codes, use them as strong hints but classify to FSC independently.
- If inputs are sparse, return fewer codes with lower confidence rather than guessing.
- The "evidence" field must be a verbatim substring of the inputs above.

Return ONLY a JSON object. No prose before or after. No markdown fences.

{
  "analysis": "one-sentence summary of what the company does",
  "codes": [
    {"code": "5985", "confidence": "high", "reasoning": "...", "evidence": "..."}
  ]
}
```

## Phases

### Phase 0 — Setup (BEFORE `git init`)

All of this happens in the working directory without initializing git. The timer starts at the initial commit, so everything below goes into that commit at once.

- [ ] OpenRouter key works (`curl` test with dummy prompt)
- [ ] Model slug `anthropic/claude-sonnet-4.6` is live on OpenRouter
- [ ] `data/AV_FSCClassAssignment.pdf` in place
- [ ] `data/fsc_codes.json` in place with 580 entries, spot-checked against PDF
- [ ] `.gitignore` written (covers `node_modules`, `.env`, `dist`, `build`, `.DS_Store`)
- [ ] `.env.example` written, `.env` present locally with the key
- [ ] Scaffold: Vite + React + TS + Tailwind in `web/`, Express + TS in `server/`
- [ ] Vite proxy `/api` → `http://localhost:3000`
- [ ] Stub `POST /api/classify` returning hardcoded ClassifyResponse
- [ ] Frontend form submits, renders stub response — round-trip verified
- [ ] `smoke.ts` skeleton written, runs against stub successfully
- [ ] PLAN.md, CLAUDE.md, README stub all present

**Starting gun:**

- [ ] `git init`
- [ ] `git add . && git commit -m "initial commit: plan, scaffolding, data, stub endpoint"`
- [ ] **T+0 starts here.** 4 hours to the last commit.
- [ ] Create public GitHub repo named `fsc-classifier`, push

### Phase 1 — Happy path: URL classification (0:00–0:45)

- [ ] `scrape.ts`: fetch URL with browser user-agent header, parse with cheerio, remove `<script>`/`<style>`/`<nav>`/`<footer>`/`<aside>`/`<iframe>`/`<noscript>`, prefer `<main>`/`<article>`/`[role="main"]` content (fall through to `<body>`), collapse whitespace, slice to 8000 chars
- [ ] `fsc.ts`: load JSON, validate exactly 580 entries, no duplicates, all 4-digit
- [ ] `prompt.ts`: build the prompt from inputs + FSC list
- [ ] `parser.ts`: strip fences, extract first `{...}` substring, `JSON.parse`, validate shape
- [ ] `classify.ts`: call OpenRouter, parse response, hydrate codes with group info from `fsc.ts`
- [ ] Wire `POST /api/classify` → scrape → classify → shaped response
- [ ] Frontend: form with name + URL, POST, render code cards with evidence
- [ ] **Smoke:** Loos & Co URL — scrape returns >1000 chars of product content, classification hits cable/wire rope/aircraft-adjacent codes with strong evidence quotes
- [ ] **Verify:** scrape output length is within 2x of `curl -A <browser-ua>` output length on the same URL — if wildly different, the selectors are stripping too much or too little
- [ ] Commit: `feat: end-to-end url classification`

### Phase 2 — PDF upload (0:45–1:15)

- [ ] Add `multer` middleware, 10MB limit, `memoryStorage()`
- [ ] `pdf.ts`: `pdf-parse` → text
- [ ] Route handler concatenates: website text + PDF text + description
- [ ] Frontend: file input, FormData submit
- [ ] **Smoke:** LSDP capability statement PDF → CNC machining / fabrication codes
- [ ] Commit: `feat: pdf upload and extraction`

### Phase 3 — Failure modes + email fallback (1:15–2:00)

- [ ] Scraper: try HTTPS, fall back to HTTP on connection errors
- [ ] Scraper: custom `https.Agent` with `rejectUnauthorized: false` for expired SSL certs (H&R Parts has this — must work)
- [ ] Scraper: 10s timeout via `AbortController`
- [ ] Scraper: never throw — return `{ ok, chars, text, error }`
- [ ] Email-to-URL derivation (strip user, prepend `https://`, skip consumer providers)
- [ ] If derived URL scrape fails, keep email domain as weak signal in prompt
- [ ] Description textarea in form — available for companies with no URL or when all scrapes fail (contingency for test 4)
- [ ] UI: `sources` badges showing what worked/failed
- [ ] **Smoke 1:** H&R Parts URL — scrape succeeds via SSL bypass, classification hits sheet metal/aircraft component codes
- [ ] **Smoke 2:** A clearly broken URL (`https://example.invalid`) returns graceful `{ ok: false, error: "..." }` and the classifier still runs (returning empty codes or working from name alone)
- [ ] Commit: `feat: robust input handling and email fallback`

### Phase 4 — Polish (2:00–2:45)

- [ ] Evidence quote displayed under each code card (italic)
- [ ] Confidence badge, color-coded (green/yellow/gray)
- [ ] Codes grouped in UI by FSG major group
- [ ] Loading state with stage indicator ("scraping", "classifying")
- [ ] Inline error display for OpenRouter failures
- [ ] Commit: `feat: ui polish`

### Phase 5 — README + final verification (2:45–3:15)

- [ ] Run all 3 sample companies end-to-end as a final sanity check
- [ ] README: architecture summary, tradeoff list, "production considerations" section, setup/run instructions
- [ ] Commit: `docs: readme`

### Phase 6 — Buffer (3:15–4:00)

- [ ] Run all 3 smoke tests one last time
- [ ] Push to GitHub, verify clone-and-run works from scratch
- [ ] Final commit

## Pre-commit Checklist (every phase)

- [ ] `tsc --noEmit` clean on server AND web
- [ ] `npm run smoke` passes
- [ ] No debug `console.log` left in (except intentional `[module]` logs)
- [ ] `.env` not staged
- [ ] Commit message starts with `feat:`, `fix:`, `docs:`, or `refactor:` (initial commit is the exception)

## Testing Strategy

- **Startup validation** in `fsc.ts`: exactly 580 codes, 4-digit format, no dupes. Fail fast on load.
- **Parser fixtures** in `parser.test.ts`: clean JSON, fenced JSON, preamble, trailing prose — all must parse.
- **Smoke script** hits real endpoint with 3 sample companies. Run after every phase.
- **No UI tests.** Eyeball.
- **No OpenRouter mocks.** Real calls.

After first successful run on each company, cache scraped text + PDF text into `server/fixtures/*.txt`. Adds `--offline` flag to smoke script for prompt iteration without network flake.

## Contingency / Cut List

If behind schedule at 2:00, cut in this order:

1. **Codes grouped by FSG in UI** — flat list is fine
2. **Loading stage indicator** — plain spinner is fine
3. **Source status badges** — plain text labels are fine
4. **Color-coded confidence** — text labels are fine

Do NOT cut:
- Three-input convergence (test data requires it)
- Evidence quotes (core differentiator)
- Error handling on scrape failure (test 4 unknown may have unreachable URL)
- README (the writeup is half the grade)

## Don't Build

Explicitly out of scope. If Claude Code proposes any of these, reject:

- Databases, persistence, caching (mention in README's production considerations)
- Authentication, user accounts, sessions
- Vector stores, embeddings, RAG — full list fits in one prompt
- Two-pass classification (group → code) — mention in README
- Self-critique or rejected-codes pass — mention in README
- Retry logic on LLM failures — surface errors instead
- React Router — one page
- State libraries — `useState` only
- i18n, dark mode toggle, settings page
- Chunking the FSC list — send it whole

## Quick Reference

- **Model slug:** `anthropic/claude-sonnet-4.6`
- **FSC count:** exactly 580
- **Test companies:** Loos (URL, clean scrape), H&R Parts (URL, SSL cert expired — scrape works via bypass), LSDP (PDF only, no URL)
- **Scraper char limit:** 8000
- **PDF size limit:** 10MB
- **Request timeout:** 10s
- **Consumer email blocklist:** gmail, yahoo, outlook, hotmail, aol, protonmail