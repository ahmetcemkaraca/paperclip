import { z } from "zod";

export const DEFAULT_RATE_LIMIT_KEYWORDS = [
  "rate limit",
  "rate-limited",
  "rate limited",
  "usage limit",
  "quota exceeded",
  "too many requests",
  "throttled",
  "throttling",
  "try again later",
];

export const fallbackConfigSchema = z.object({
  enabled: z.boolean().optional().default(true),
  adapterId: z.string().min(1).optional(),
  adapterType: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  rateLimitKeywords: z.array(z.string().min(1)).optional(),
  issueCommentOrder: z.enum(["newest_first", "newest_last"]).optional(),
});
