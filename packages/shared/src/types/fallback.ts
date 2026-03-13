/**
 * Fallback configuration for automatic retry with alternative adapter/model
 * when detection keywords appear in agent execution output.
 */
export interface FallbackConfig {
  /**
   * Enable or disable fallback functionality
   */
  enabled?: boolean;

  /**
   * Alternative adapter to use for fallback execution.
   * If not specified, uses the same adapter type as the primary execution.
   */
  adapterType?: string;

  /**
   * Alternative model/configuration to use for fallback.
   * For local adapters, this is the model ID (e.g., "gpt-5.3-codex").
   * For HTTP adapters, this can be any adapter-specific config.
   */
  modelId?: string;

  /**
   * Keywords/phrases that trigger fallback when detected in execution output.
   * If not specified, uses a default set of rate-limit detection keywords.
   * Examples: "usage limit", "exceeded", "throttling", "rate limited", "quota"
   */
  rateLimitKeywords?: string[];
}

/**
 * Fallback action that was triggered during execution
 */
export interface FallbackAction {
  /**
   * Timestamp when fallback was triggered
   */
  triggeredAt: Date;

  /**
   * The detected keyword or reason for fallback
   */
  detectionReason: string;

  /**
   * Original adapter type and model used
   */
  original: {
    adapterType: string;
    modelId?: string;
  };

  /**
   * Fallback adapter type and model used for retry
   */
  fallback: {
    adapterType: string;
    modelId?: string;
  };

  /**
   * Result of fallback execution: "success" or "failed"
   */
  result: "success" | "failed";
}
