import "dotenv/config";
import express from "express";
import multer from "multer";
import type { ClassifyResponse } from "./types.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/classify", upload.single("pdf"), (req, res) => {
  const companyName = (req.body?.companyName as string | undefined) ?? "Unknown";
  const stub: ClassifyResponse = {
    companyName,
    analysis: "(stub) end-to-end round-trip — classifier not yet wired.",
    sources: {
      website: { ok: false, chars: 0 },
      pdf: { ok: false, chars: 0 },
      description: { ok: false, chars: 0 },
      email: { ok: false, chars: 0 },
    },
    codes: [
      {
        code: "0000",
        description: "STUB",
        group_code: "00",
        group_name: "Stub Group",
        confidence: "low",
        reasoning: "Placeholder response from stub endpoint.",
        evidence: "(none)",
      },
    ],
  };
  res.json(stub);
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
