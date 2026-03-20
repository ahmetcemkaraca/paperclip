import type { FallbackConfig } from "@paperclipai/shared";
import { DEFAULT_RATE_LIMIT_KEYWORDS } from "@paperclipai/shared";
import type { AdapterExecutionResult } from "../adapters/index.js";

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeFallbackConfig(config: FallbackConfig | null | undefined): FallbackConfig | null {
  if (!config || typeof config !== "object") return null;
  return {
    enabled: config.enabled,
    adapterId: asNonEmptyString(config.adapterId) ?? undefined,
    adapterType: asNonEmptyString(config.adapterType) ?? undefined,
    modelId: asNonEmptyString(config.modelId) ?? undefined,
    rateLimitKeywords: asStringArray(config.rateLimitKeywords),
    issueCommentOrder: config.issueCommentOrder,
  };
}

export function containsRateLimitKeywords(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

export interface FallbackDetectionResult {
  isRateLimit: boolean;
  detectedKeyword: string | null;
}

export function detectRateLimitInResult(
  result: AdapterExecutionResult,
  keywords: string[],
): FallbackDetectionResult {
  const resultText =
    result.resultJson && typeof result.resultJson === "object"
      ? JSON.stringify(result.resultJson)
      : null;
  const haystacks = [result.errorMessage, result.summary, resultText]
    .map((value) => asNonEmptyString(value))
    .filter((value): value is string => Boolean(value));

  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase();
    if (haystacks.some((text) => text.toLowerCase().includes(normalizedKeyword))) {
      return { isRateLimit: true, detectedKeyword: keyword };
    }
  }

  return { isRateLimit: false, detectedKeyword: null };
}

export function resolveFallbackConfig(
  agentFallbackConfig: FallbackConfig | null | undefined,
  companyFallbackConfig: FallbackConfig | null | undefined,
): FallbackConfig | null {
  const company = normalizeFallbackConfig(companyFallbackConfig);
  const agent = normalizeFallbackConfig(agentFallbackConfig);
  const merged = { ...(company ?? {}), ...(agent ?? {}) } as FallbackConfig;
  return Object.keys(merged).length > 0 ? merged : null;
}

export function shouldAttemptFallback(
  agentFallbackConfig: FallbackConfig | null | undefined,
  companyFallbackConfig: FallbackConfig | null | undefined,
  executionResult: AdapterExecutionResult,
): boolean {
  const resolved = resolveFallbackConfig(agentFallbackConfig, companyFallbackConfig);
  if (!resolved) return false;
  if (resolved.enabled === false) return false;
  if (!resolved.adapterType && !resolved.modelId && !resolved.adapterId) return false;

  const keywords =
    resolved.rateLimitKeywords && resolved.rateLimitKeywords.length > 0
      ? resolved.rateLimitKeywords
      : DEFAULT_RATE_LIMIT_KEYWORDS;

  return detectRateLimitInResult(executionResult, keywords).isRateLimit;
}
