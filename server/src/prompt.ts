import type { FscEntry } from "./fsc.js";

export type PromptInputs = {
  companyName: string;
  websiteText?: string;
  pdfText?: string;
  description?: string;
  email?: string;
  fscCodes: FscEntry[];
};

export function buildPrompt(i: PromptInputs): string {
  const website = i.websiteText?.trim() || "(unavailable)";
  const pdf = i.pdfText?.trim() || "(none)";
  const description = i.description?.trim() || "(none)";
  const email = i.email?.trim() || "(none)";
  const fscList = JSON.stringify(
    i.fscCodes.map((e) => ({ code: e.code, description: e.description })),
  );

  return `You are classifying a company against the U.S. Federal Supply Classification (FSC) system used by the U.S. government for procurement.

COMPANY NAME: ${i.companyName}

INPUTS (use all that are present):

--- WEBSITE CONTENT ---
${website}

--- UPLOADED DOCUMENT ---
${pdf}

--- USER DESCRIPTION ---
${description}

--- CONTACT EMAIL ---
${email}
(Company email domain may hint at industry or parent organization; weight lightly.)

--- FSC CODE LIST ---
${fscList}

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
}`;
}
