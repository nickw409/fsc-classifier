export type RawCode = {
  code: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  evidence: string;
};

export type ParsedLLM = {
  analysis: string;
  codes: RawCode[];
};

const FENCE_RE = /^\s*```(?:json)?\s*|\s*```\s*$/g;
const CODE_RE = /^\d{4}$/;
const CONFIDENCE = new Set(["high", "medium", "low"]);

export function parseLLMResponse(raw: string): ParsedLLM {
  const stripped = raw.replace(FENCE_RE, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error(`[parser] no JSON object found in response: ${truncate(raw)}`);
  }
  const slice = stripped.slice(start, end + 1);
  let obj: unknown;
  try {
    obj = JSON.parse(slice);
  } catch (e) {
    throw new Error(`[parser] JSON.parse failed: ${(e as Error).message} on: ${truncate(slice)}`);
  }
  if (!obj || typeof obj !== "object") {
    throw new Error(`[parser] expected object, got ${typeof obj}`);
  }
  const o = obj as Record<string, unknown>;
  if (typeof o.analysis !== "string") {
    throw new Error(`[parser] missing string 'analysis'`);
  }
  if (!Array.isArray(o.codes)) {
    throw new Error(`[parser] 'codes' must be an array`);
  }
  const codes: RawCode[] = [];
  for (const item of o.codes) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (typeof c.code !== "string" || !CODE_RE.test(c.code)) continue;
    if (typeof c.confidence !== "string" || !CONFIDENCE.has(c.confidence)) continue;
    codes.push({
      code: c.code,
      confidence: c.confidence as "high" | "medium" | "low",
      reasoning: typeof c.reasoning === "string" ? c.reasoning : "",
      evidence: typeof c.evidence === "string" ? c.evidence : "",
    });
  }
  return { analysis: o.analysis, codes };
}

function truncate(s: string): string {
  return s.length > 200 ? `${s.slice(0, 200)}...` : s;
}
