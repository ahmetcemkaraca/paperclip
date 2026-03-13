import { z } from "zod";

export const fallbackConfigSchema = z.object({
  enabled: z.boolean().optional().default(false),
  adapterType: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  rateLimitKeywords: z.array(z.string().min(1)).optional(),
});

export type FallbackConfig = z.infer<typeof fallbackConfigSchema>;

// Default keywords to detect rate-limiting/quota issues
export const DEFAULT_RATE_LIMIT_KEYWORDS = [
  "usage limit",
  "usage exceeded",
  "quota exceeded",
  "rate limit",
  "rate limited",
  "throttl",
  "too many requests",
  "request timeout",
  "out of credits",
  "insufficient credits",
  "exceeded",
  "limit exceeded",
];
