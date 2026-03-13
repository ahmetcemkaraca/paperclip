import { DEFAULT_RATE_LIMIT_KEYWORDS } from "@paperclipai/shared";
import type { FallbackConfig } from "@paperclipai/shared";
import type { AdapterExecutionResult } from "../adapters/index.js";

/**
 * Check if a string contains any of the specified keywords (case-insensitive).
 */
export function containsRateLimitKeywords(text: string, keywords: string[]): boolean {
  if (!text || !keywords || keywords.length === 0) return false;
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

export interface FallbackDetectionResult {
  isRateLimit: boolean;
  detectedKeyword: string | null;
}

/**
 * Analyze adapter execution result for rate-limiting indicators.
 * Checks both stdout/stderr output and error messages.
 */
export function detectRateLimitInResult(
  result: AdapterExecutionResult,
  keywords: string[],
): FallbackDetectionResult {
  const keywordsToCheck = keywords.length > 0 ? keywords : DEFAULT_RATE_LIMIT_KEYWORDS;

  // Check error message
  if (result.errorMessage) {
    for (const keyword of keywordsToCheck) {
      if (
        result.errorMessage.toLowerCase().includes(keyword.toLowerCase())
      ) {
        return { isRateLimit: true, detectedKeyword: keyword };
      }
    }
  }

  // Check stdout and stderr in resultJson
  if (result.resultJson) {
    const stdout = result.resultJson.stdout;
    const stderr = result.resultJson.stderr;

    if (typeof stdout === "string") {
      for (const keyword of keywordsToCheck) {
        if (stdout.toLowerCase().includes(keyword.toLowerCase())) {
          return { isRateLimit: true, detectedKeyword: keyword };
        }
      }
    }

    if (typeof stderr === "string") {
      for (const keyword of keywordsToCheck) {
        if (stderr.toLowerCase().includes(keyword.toLowerCase())) {
          return { isRateLimit: true, detectedKeyword: keyword };
        }
      }
    }
  }

  return { isRateLimit: false, detectedKeyword: null };
}

/**
 * Determine if fallback execution should be attempted.
 */
export function shouldAttemptFallback(
  agentFallbackConfig: FallbackConfig,
  companyFallbackConfig: FallbackConfig | null | undefined,
  executionResult: AdapterExecutionResult,
): boolean {
  // Check agent-level fallback first
  if (agentFallbackConfig.enabled && agentFallbackConfig.modelId) {
    const keywords = agentFallbackConfig.rateLimitKeywords || DEFAULT_RATE_LIMIT_KEYWORDS;
    const { isRateLimit } = detectRateLimitInResult(executionResult, keywords);
    if (isRateLimit) return true;
  }

  // Check company-level fallback if agent-level didn't match
  if (
    companyFallbackConfig?.enabled &&
    (companyFallbackConfig.modelId || companyFallbackConfig.adapterType)
  ) {
    const keywords = companyFallbackConfig.rateLimitKeywords || DEFAULT_RATE_LIMIT_KEYWORDS;
    const { isRateLimit } = detectRateLimitInResult(executionResult, keywords);
    if (isRateLimit) return true;
  }

  return false;
}

/**
 * Get the fallback configuration to use, prioritizing agent-level over company-level.
 */
export function resolveFallbackConfig(
  agentFallbackConfig: FallbackConfig,
  companyFallbackConfig: FallbackConfig | null | undefined,
): FallbackConfig | null {
  // Use agent-level fallback if enabled
  if (agentFallbackConfig.enabled && agentFallbackConfig.modelId) {
    return agentFallbackConfig;
  }

  // Fall back to company-level if enabled
  if (
    companyFallbackConfig?.enabled &&
    (companyFallbackConfig.modelId || companyFallbackConfig.adapterType)
  ) {
    return companyFallbackConfig;
  }

  return null;
}
