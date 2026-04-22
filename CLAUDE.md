# CLAUDE.md

Instructions for Claude Code working on this repository.

## Project

FSC Code Classifier — take-home assignment for SalesPatriot final round. Given a
company (name + URL + optional PDF + optional description), classify it against
US Federal Supply Classification (FSC) codes using an LLM. See `PLAN.md` for
full context, phase sequence, and demo narrative.

**Time-boxed build.** Correctness and working end-to-end beat polish. Do the
simplest thing that works. When in doubt, ship a shim and a TODO comment.

## Commands

```bash
# Server
cd server
npm run dev        # tsx watch src/index.ts
npm test           # node --test tests/parser.test.ts
npm run smoke      # tsx tests/smoke.ts (hits live /api/classify)

# Web
cd web
npm run dev        # vite
npm run build      # vite build
```

Both dev servers run concurrently. Vite proxies `/api/*` to `http://localhost:3000`.

Server boots on port 3000. Web on Vite default (5173).

## Stack

- **Node:** 20+
- **TypeScript:** strict mode, `"module": "nodenext"` on server, Vite default on web
- **Express:** 4.x (not 5 — 5 is beta and has middleware quirks)
- **Multer:** 1.x for PDF uploads (single file, 10MB limit, in-memory `multer.memoryStorage()`)
- **pdf-parse:** for PDF text extraction
- **cheerio:** for HTML parsing in `scrape.ts` (strip nav/footer/script/style, prefer main/article)
- **React:** 18, Vite template default
- **Styling:** Tailwind if set up in first 10 min; otherwise plain CSS modules. Don't mix.
- **LLM:** OpenRouter → `anthropic/claude-sonnet-4.6`
- **No other deps** without checking PLAN.md — scope is deliberately tight.

## Directory Layout

```
/
├── CLAUDE.md                # this file
├── PLAN.md                  # human-facing build plan
├── README.md                # deliverable writeup
├── .env.example             # OPENROUTER_API_KEY=
├── .env                     # gitignored, real key
├── data/
│   ├── AV_FSCClassAssignment._151007.pdf
│   └── fsc_codes.json       # 580 entries, pre-validated
├── server/
│   ├── src/
│   │   ├── index.ts         # express app + route wiring
│   │   ├── scrape.ts        # url → { ok, text, error }
│   │   ├── pdf.ts           # Buffer → { ok, text, error }
│   │   ├── classify.ts      # (text, name) → { codes, analysis }
│   │   ├── fsc.ts           # load + validate fsc_codes.json
│   │   ├── prompt.ts        # build LLM prompt
│   │   ├── parser.ts        # LLM response → JSON
│   │   └── types.ts         # ClassifyResponse, Code, etc.
│   ├── fixtures/            # cached LLM responses + scrapes
│   └── tests/
│       ├── parser.test.ts   # LLM response parsing only
│       └── smoke.ts         # e2e against 3 sample companies
└── web/
    └── src/
        ├── App.tsx
        ├── api.ts           # fetch wrapper
        ├── types.ts         # COPY of server types (keep in sync)
        └── components/
            ├── CompanyForm.tsx
            └── ResultsDisplay.tsx
```

## Shared Types (single source of truth)

Server defines types in `server/src/types.ts`. Web has its own copy in
`web/src/types.ts` — keep them manually in sync. Don't set up path aliases or a
shared package; it's not worth the build complexity for this scope.

```ts
// types.ts (both sides)
export type SourceStatus = {
  ok: boolean;
  chars: number;
  error?: string;
};

export type EmailSourceStatus = SourceStatus & { derivedUrl?: string };

export type FscCode = {
  code: string;           // 4-digit
  description: string;    // from fsc_codes.json
  group_code: string;     // 2-digit
  group_name: string;     // from fsc_codes.json
  confidence: "high" | "medium" | "low";
  reasoning: string;
  evidence: string;
};

export type ClassifyResponse = {
  companyName: string;
  analysis: string;       // LLM's 1-sentence summary
  sources: {
    website: SourceStatus;
    pdf: SourceStatus;
    description: SourceStatus;
    email: EmailSourceStatus;
  };
  codes: FscCode[];
  rawLLMResponse?: string; // include when ?debug=1
};
```

## Conventions

- **TypeScript strict.** No `any`. Prefer `unknown` + narrowing.
- **Named exports** everywhere except React components (default export for those).
- **Async/await** only. No `.then()` chains.
- **Errors:** throw `Error` with context; don't swallow. At the HTTP boundary, catch and return `{ ok: false, error: message }` — never let the server 500.
- **No comments that restate the code.** Comments explain *why*, not *what*.
- **Log on the server** with `console.log` prefixed by module name: `[scrape]`, `[classify]`, `[pdf]`. Helps debugging during the build.
- **Don't add dependencies** without checking they're needed. Every new dep is ~30 seconds of install + risk of breakage.

## Visual Direction

Clean, dense, functional — internal tool aesthetic, not marketing site. 
Reference: Linear, Vercel dashboard, Retool.

- Neutral palette (slate/gray scale) with one accent color for interactive elements
- Information density over whitespace
- Small type, tight line-height
- Subtle borders (1px slate-200) instead of shadows
- No gradients, no hero sections, no illustrations
- Loading spinner only — no other animation
- Monospace for code numbers (4-digit FSC codes)
- Confidence badges as small pills, color-coded 
  (emerald for high, amber for medium, slate for low)
- Evidence quotes rendered as italic blockquote with a left border accent

## LLM Response Parsing

The model sometimes wraps JSON in markdown fences, adds preamble, or trails prose.
`classify.ts` must parse all of these. Implementation:

1. If response starts/ends with ` ``` ` fences, strip them.
2. Find first `{` and matching last `}`.
3. `JSON.parse` that substring.
4. Validate with manual shape check (no zod — keep deps tight).

See `tests/parser.test.ts` for required fixtures.

## Testing Rules

- **DO** test the LLM response parser against fenced, preamble, and trailing-prose fixtures. This is the only brittle boundary.
- **DO** run the smoke script after every phase commit.
- **DON'T** test UI components. Eyeball them.
- **DON'T** mock OpenRouter. The latency is fine for this scope.
- **DON'T** test the Express route plumbing. The smoke script covers it.

## Don't Build

Reject scope creep from these categories — they are explicitly out:

- Databases, persistence, caching
- Authentication, user accounts
- Vector stores, embeddings, RAG
- Retry logic on LLM failures (surface the error instead)
- React Router — one page only
- State libraries — `useState` is enough
- Rate limiting, CORS beyond Vite proxy
- i18n, dark mode, settings pages
- Animations beyond a spinner
- Chunking the FSC list — send it whole
- Two-pass classification (group → code) — mention in README as "with more time"
- Any feature to cache, retry, or store past classifications

## Git

**Do not commit.** The user handles all commits manually. When a logical chunk
is done, say "This looks like a good commit point — suggested message: `feat:
pdf upload and extraction`" and stop. Wait for user to commit before continuing.

**Do not create branches.** Single `main` branch.

## Environment

`.env` at repo root (or copied into server/):

```
OPENROUTER_API_KEY=sk-or-...
```

Load via `dotenv` on server startup. Never log the key. Never put it in frontend code.

## OpenRouter Call Shape

```ts
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "anthropic/claude-sonnet-4.6",
    messages: [{ role: "user", content: prompt }],
    // Don't use response_format: { type: "json_object" } — not supported on all
    // models via OpenRouter, and our parser handles fences anyway.
  }),
});
const data = await response.json();
const text = data.choices[0].message.content;
```

If OpenRouter returns non-200, throw with the response body. Don't retry.

## FSC Data

`data/fsc_codes.json` contains 580 DLA/GSA-managed FSC codes. Schema:

```json
{
  "code": "1620",
  "description": "Aircraft Landing Gear Components",
  "group_code": "16",
  "group_name": "Aircraft Components and Accessories"
}
```

`fsc.ts` loads this at server startup and validates:
- 580 codes
- every `code` matches `/^\d{4}$/`
- no duplicates

If validation fails, server refuses to start.

## When to Stop and Ask

Ask the user before:
- Adding a new dependency
- Changing the API contract in `types.ts`
- Deviating from the phase sequence in PLAN.md
- Adding anything on the "Don't Build" list
- Committing (never commit)

Proceed without asking for:
- Bug fixes inside the agreed scope
- Refactoring within a single file
- CSS/styling choices
- Variable names, internal function structure

## Current Status

See `PLAN.md` for phase sequence. At start of each work session, confirm which
phase we're in and what the last completed task was.