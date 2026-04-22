import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export type FscEntry = {
  code: string;
  description: string;
  group_code: string;
  group_name: string;
};

const EXPECTED_COUNT = 580;
const CODE_RE = /^\d{4}$/;

let byCode: Map<string, FscEntry> | null = null;
let all: FscEntry[] = [];

export async function loadFscCodes(): Promise<FscEntry[]> {
  if (byCode) return all;
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, "../../data/fsc_codes.json");
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`[fsc] fsc_codes.json is not an array`);
  }
  const entries = parsed as FscEntry[];
  if (entries.length !== EXPECTED_COUNT) {
    throw new Error(`[fsc] expected ${EXPECTED_COUNT} entries, got ${entries.length}`);
  }
  const seen = new Set<string>();
  for (const e of entries) {
    if (!e || typeof e.code !== "string" || !CODE_RE.test(e.code)) {
      throw new Error(`[fsc] invalid code shape: ${JSON.stringify(e)}`);
    }
    if (seen.has(e.code)) {
      throw new Error(`[fsc] duplicate code: ${e.code}`);
    }
    seen.add(e.code);
    if (typeof e.description !== "string" || typeof e.group_code !== "string" || typeof e.group_name !== "string") {
      throw new Error(`[fsc] missing fields on code ${e.code}`);
    }
  }
  all = entries;
  byCode = new Map(entries.map((e) => [e.code, e]));
  console.log(`[fsc] loaded ${entries.length} codes`);
  return all;
}

export function lookupFsc(code: string): FscEntry | undefined {
  if (!byCode) throw new Error("[fsc] loadFscCodes() not called yet");
  return byCode.get(code);
}

export function allFsc(): FscEntry[] {
  if (!byCode) throw new Error("[fsc] loadFscCodes() not called yet");
  return all;
}
