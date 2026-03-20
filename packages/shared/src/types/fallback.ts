export interface FallbackConfig {
  enabled?: boolean;
  adapterId?: string;
  adapterType?: string;
  modelId?: string;
  rateLimitKeywords?: string[];
  issueCommentOrder?: "newest_first" | "newest_last";
}

export interface FallbackAction {
  triggeredAt: Date;
  detectionReason: string;
  original: {
    adapterType: string;
    modelId?: string;
  };
  fallback: {
    adapterType: string;
    modelId?: string;
  };
  result: "success" | "failed";
}
