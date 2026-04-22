# FSC Classifier

Classifies a company against U.S. Federal Supply Classification (FSC) codes from
a company name plus any of: website URL, contact email, capability-statement
PDF, or free-text description.

**Status:** scaffolding / stub round-trip. Classifier not yet wired. See
[PLAN.md](./PLAN.md) for phase sequence.

## Requirements

- Node 20+
- An OpenRouter API key in `.env` at repo root:

  ```
  OPENROUTER_API_KEY=sk-or-...
  ```

  Copy `.env.example` as a starting point.

## Running

Two terminals:

```bash
# terminal 1 — API server on :3000
cd server
npm install
npm run dev

# terminal 2 — Vite dev on :5173 (proxies /api → :3000)
cd web
npm install
npm run dev
```

Then open <http://localhost:5173>.

## Smoke test

With the server running in another terminal:

```bash
cd server
npm run smoke
```

Hits the live `/api/classify` endpoint and verifies shape.

## Architecture (short)

- **server/** — Express + TypeScript, run via `tsx`. One endpoint:
  `POST /api/classify` accepts multipart form data and returns
  `ClassifyResponse` (see `server/src/types.ts`).
- **web/** — Vite + React + TypeScript + Tailwind. Single-page form +
  results view. Proxies `/api/*` to `http://localhost:3000` in dev.
- **data/fsc_codes.json** — 580 DLA/GSA-managed FSC codes, loaded and
  validated at server startup.

## Tradeoffs / production considerations

_To be filled in during the README phase. See PLAN.md for the list._
