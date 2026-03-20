import { z } from "zod";
import { AGENT_ADAPTER_TYPES } from "../constants.js";

export const fallbackConfigSchema = z.object({
  enabled: z.boolean().optional(),
  adapterId: z.string().min(1).optional().nullable(),
  adapterType: z.enum(AGENT_ADAPTER_TYPES).optional().nullable(),
  modelId: z.string().min(1).optional().nullable(),
  rateLimitKeywords: z.array(z.string().min(1)).optional().nullable(),
});

export type FallbackConfigInput = z.infer<typeof fallbackConfigSchema>;
