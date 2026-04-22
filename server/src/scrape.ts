import * as cheerio from "cheerio";
import { Agent, fetch as undiciFetch } from "undici";
import type { SourceStatus } from "./types.js";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT_MS = 10_000;
const MAX_CHARS = 8000;

// Insecure agent only used as a retry fallback after a cert failure.
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

export type ScrapeResult = SourceStatus & { text: string };

export async function scrape(inputUrl: string): Promise<ScrapeResult> {
  const url = normalize(inputUrl);

  let attempt = await tryFetch(url, { insecure: false });
  if (!attempt.ok && isCertError(attempt.error)) {
    console.log(`[scrape] ${url} cert issue — retrying with SSL verification disabled`);
    attempt = await tryFetch(url, { insecure: true });
  }
  if (!attempt.ok && url.startsWith("https://") && isConnectionError(attempt.error)) {
    const httpUrl = "http://" + url.slice("https://".length);
    console.log(`[scrape] ${url} connection failed — falling back to ${httpUrl}`);
    attempt = await tryFetch(httpUrl, { insecure: false });
  }

  if (!attempt.ok) {
    console.log(`[scrape] ${url} FAIL: ${attempt.error}`);
    return { ok: false, chars: 0, text: "", error: attempt.error ?? "unknown error" };
  }

  const text = extractText(attempt.body);
  console.log(`[scrape] ${url} -> ${text.length} chars`);
  return { ok: true, chars: text.length, text };
}

type FetchOutcome = { ok: true; body: string } | { ok: false; error: string };

async function tryFetch(url: string, opts: { insecure: boolean }): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await undiciFetch(url, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      signal: controller.signal,
      redirect: "follow",
      ...(opts.insecure ? { dispatcher: insecureAgent } : {}),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, body: await res.text() };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  } finally {
    clearTimeout(timer);
  }
}

function describeError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = (e as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as Error & { code?: unknown }).code;
    return `${e.message}: ${cause.message}${code ? ` (${String(code)})` : ""}`;
  }
  if (cause && typeof cause === "object" && "code" in cause) {
    return `${e.message}: ${String((cause as { code: unknown }).code)}`;
  }
  return e.message;
}

function normalize(url: string): string {
  if (!/^https?:\/\//i.test(url)) return `https://${url}`;
  return url;
}

function isCertError(msg: string | undefined): boolean {
  if (!msg) return false;
  return /CERT|certificate|self.signed|ALPN|ssl|tls|unable to verify/i.test(msg);
}

function isConnectionError(msg: string | undefined): boolean {
  if (!msg) return false;
  return /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ECONNRESET|getaddrinfo|Connect Timeout/i.test(msg);
}

export function extractText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, aside, iframe, noscript, svg, template").remove();
  const containers = ["main", "article", "[role='main']"];
  let body = "";
  for (const sel of containers) {
    const node = $(sel).first();
    if (node.length && node.text().trim().length > 200) {
      body = node.text();
      break;
    }
  }
  if (!body) body = $("body").text();
  const collapsed = body.replace(/\s+/g, " ").trim();
  return collapsed.slice(0, MAX_CHARS);
}
