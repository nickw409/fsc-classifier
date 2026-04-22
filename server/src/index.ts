import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });
loadEnv();
import express, { type Request, type Response } from "express";
import multer from "multer";
import { loadFscCodes } from "./fsc.js";
import { scrape } from "./scrape.js";
import { extractPdf } from "./pdf.js";
import { classify } from "./classify.js";
import { deriveUrlFromEmail, isConsumerEmail } from "./email.js";
import type { ClassifyResponse, EmailSourceStatus, SourceStatus } from "./types.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/classify", upload.single("pdf"), async (req: Request, res: Response) => {
  try {
    const companyName = str(req.body?.companyName) ?? "Unknown";
    const websiteUrl = str(req.body?.websiteUrl);
    const email = str(req.body?.email);
    const description = str(req.body?.description);
    const debug = req.query?.debug === "1";

    const pdfFile = req.file;

    const derivedUrl = websiteUrl ? undefined : deriveUrlFromEmail(email);
    const scrapeTarget = websiteUrl ?? derivedUrl;

    const t0 = Date.now();
    const [website, pdf] = await Promise.all([
      scrapeTarget ? scrape(scrapeTarget) : Promise.resolve({ ok: false, chars: 0, text: "" }),
      pdfFile ? extractPdf(pdfFile.buffer) : Promise.resolve({ ok: false, chars: 0, text: "" }),
    ]);
    const tExtract = Date.now();

    const descStatus: SourceStatus = description
      ? { ok: true, chars: description.length }
      : { ok: false, chars: 0 };

    const emailStatus: EmailSourceStatus = email
      ? {
          ok: true,
          chars: email.length,
          ...(derivedUrl ? { derivedUrl } : {}),
          ...(isConsumerEmail(email) ? { error: "consumer email provider; not used as URL signal" } : {}),
        }
      : { ok: false, chars: 0 };

    const result = await classify({
      companyName,
      websiteText: website.ok ? website.text : undefined,
      pdfText: pdf.ok ? pdf.text : undefined,
      description,
      email: email && !isConsumerEmail(email) ? email : undefined,
    });
    const tClassify = Date.now();
    console.log(`[timing] extract=${tExtract - t0}ms classify=${tClassify - tExtract}ms total=${tClassify - t0}ms`);

    const body: ClassifyResponse = {
      companyName,
      analysis: result.analysis,
      sources: {
        website: stripText(website),
        pdf: stripText(pdf),
        description: descStatus,
        email: emailStatus,
      },
      codes: result.codes,
      ...(debug ? { rawLLMResponse: result.rawLLMResponse } : {}),
    };
    res.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[classify] error:", message);
    res.status(500).json({ error: message });
  }
});

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

function stripText(s: SourceStatus & { text?: string }): SourceStatus {
  return { ok: s.ok, chars: s.chars, ...(s.error ? { error: s.error } : {}) };
}

const port = Number(process.env.PORT ?? 3000);

loadFscCodes()
  .then(() => {
    app.listen(port, () => {
      console.log(`[server] listening on http://localhost:${port}`);
    });
  })
  .catch((e) => {
    console.error("[server] startup failed:", e);
    process.exit(1);
  });
