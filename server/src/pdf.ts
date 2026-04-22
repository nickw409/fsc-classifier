import type { SourceStatus } from "./types.js";

const MAX_CHARS = 20_000;

export type PdfResult = SourceStatus & { text: string };

export async function extractPdf(buffer: Buffer): Promise<PdfResult> {
  try {
    const { default: pdfParse } = (await import("pdf-parse")) as {
      default: (data: Buffer) => Promise<{ text: string }>;
    };
    const parsed = await pdfParse(buffer);
    const text = (parsed.text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
    console.log(`[pdf] extracted ${text.length} chars from ${buffer.length} bytes`);
    return { ok: true, chars: text.length, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`[pdf] extraction failed: ${msg}`);
    return { ok: false, chars: 0, text: "", error: msg };
  }
}
