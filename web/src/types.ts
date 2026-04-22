// Mirror of server/src/types.ts — keep manually in sync.
export type SourceStatus = {
  ok: boolean;
  chars: number;
  error?: string;
};

export type EmailSourceStatus = SourceStatus & { derivedUrl?: string };

export type FscCode = {
  code: string;
  description: string;
  group_code: string;
  group_name: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  evidence: string;
};

export type ClassifyResponse = {
  companyName: string;
  analysis: string;
  sources: {
    website: SourceStatus;
    pdf: SourceStatus;
    description: SourceStatus;
    email: EmailSourceStatus;
  };
  codes: FscCode[];
  rawLLMResponse?: string;
};
