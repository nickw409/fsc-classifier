import { allFsc, lookupFsc } from "./fsc.js";
import { buildPrompt, type PromptInputs } from "./prompt.js";
import { parseLLMResponse } from "./parser.js";
import type { FscCode } from "./types.js";

const MODEL = "anthropic/claude-sonnet-4.6";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type ClassifyInputs = Omit<PromptInputs, "fscCodes">;

export type ClassifyResult = {
  analysis: string;
  codes: FscCode[];
  rawLLMResponse: string;
};

export async function classify(inputs: ClassifyInputs): Promise<ClassifyResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("[classify] OPENROUTER_API_KEY not set");

  const prompt = buildPrompt({ ...inputs, fscCodes: allFsc() });
  console.log(`[classify] prompt ${prompt.length} chars -> ${MODEL}`);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[classify] OpenRouter ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (typeof raw !== "string") {
    throw new Error(`[classify] unexpected response shape: ${JSON.stringify(data).slice(0, 500)}`);
  }

  const parsed = parseLLMResponse(raw);
  const hydrated: FscCode[] = [];
  for (const c of parsed.codes) {
    const entry = lookupFsc(c.code);
    if (!entry) {
      console.log(`[classify] hallucinated code dropped: ${c.code}`);
      continue;
    }
    hydrated.push({
      code: entry.code,
      description: entry.description,
      group_code: entry.group_code,
      group_name: entry.group_name,
      confidence: c.confidence,
      reasoning: c.reasoning,
      evidence: c.evidence,
    });
  }
  console.log(`[classify] hydrated ${hydrated.length}/${parsed.codes.length} codes`);
  return { analysis: parsed.analysis, codes: hydrated, rawLLMResponse: raw };
}
