import * as cheerio from "cheerio";
import type { SourceStatus } from "./types.js";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT_MS = 10_000;
const MAX_CHARS = 8000;

export type ScrapeResult = SourceStatus & { text: string };

export async function scrape(url: string): Promise<ScrapeResult> {
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      return { ok: false, chars: 0, text: "", error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const text = extractText(html);
    console.log(`[scrape] ${url} -> ${text.length} chars`);
    return { ok: true, chars: text.length, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`[scrape] ${url} FAIL: ${msg}`);
    return { ok: false, chars: 0, text: "", error: msg };
  } finally {
    clearTimeout(timer);
  }
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
