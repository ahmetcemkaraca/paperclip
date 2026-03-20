import type { AdapterExecutionResult } from "../adapters/index.js";
import { DEFAULT_RATE_LIMIT_KEYWORDS } from "@paperclipai/shared";

export interface FallbackConfig {
  enabled?: boolean | null;
  adapterId?: string | null;
  adapterType?: string | null;
  modelId?: string | null;
  rateLimitKeywords?: string[] | null;
}

export interface FallbackDetectionResult {
  shouldFallback: boolean;
  detectedKeyword: string | null;
}

function normalizeConfig(config: FallbackConfig | null | undefined): FallbackConfig {
  return config && typeof config === "object" ? config : {};
}

function collectText(result: AdapterExecutionResult): string {
  const parts: string[] = [];
  if (typeof result.stdout === "string") parts.push(result.stdout);
  if (typeof result.stderr === "string") parts.push(result.stderr);
  if (typeof result.error === "string") parts.push(result.error);
  return parts.join("\n").toLowerCase();
}

export function detectRateLimitInResult(
  result: AdapterExecutionResult,
  keywords: readonly string[] = DEFAULT_RATE_LIMIT_KEYWORDS,
): { detectedKeyword: string | null } {
  const haystack = collectText(result);
  for (const keyword of keywords) {
    if (haystack.includes(keyword.toLowerCase())) {
      return { detectedKeyword: keyword };
    }
  }
  if (result.exitCode === 429) {
    return { detectedKeyword: "429" };
  }
  return { detectedKeyword: null };
}

export function resolveFallbackConfig(
  agentConfig: FallbackConfig | null | undefined,
  companyConfig: FallbackConfig | null | undefined,
): FallbackConfig | null {
  const company = normalizeConfig(companyConfig);
  const agent = normalizeConfig(agentConfig);
  const merged: FallbackConfig = {
    enabled: agent.enabled ?? company.enabled ?? false,
    adapterId: agent.adapterId ?? company.adapterId ?? null,
    adapterType: agent.adapterType ?? company.adapterType ?? null,
    modelId: agent.modelId ?? company.modelId ?? null,
    rateLimitKeywords: agent.rateLimitKeywords ?? company.rateLimitKeywords ?? [...DEFAULT_RATE_LIMIT_KEYWORDS],
  };

  if (!merged.enabled || !merged.modelId) {
    return null;
  }
  return merged;
}

export function shouldAttemptFallback(
  agentConfig: FallbackConfig | null | undefined,
  companyConfig: FallbackConfig | null | undefined,
  result: AdapterExecutionResult,
): boolean {
  const config = resolveFallbackConfig(agentConfig, companyConfig);
  if (!config) return false;
  return detectRateLimitInResult(result, config.rateLimitKeywords ?? DEFAULT_RATE_LIMIT_KEYWORDS).detectedKeyword !== null;
}
