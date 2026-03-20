import { describe, expect, it } from "vitest";
import { estimateUsageCostUsd, findKnownModelPricing } from "./pricing.js";

describe("findKnownModelPricing", () => {
  it("matches exact ids", () => {
    expect(findKnownModelPricing("gpt-5")).not.toBeNull();
  });

  it("normalizes provider prefixes", () => {
    expect(findKnownModelPricing("openai/gpt-5.4")).not.toBeNull();
  });

  it("falls back from model variants", () => {
    expect(findKnownModelPricing("gpt-5.3-codex-high-fast")).not.toBeNull();
  });

  it("matches provider-specific aliases", () => {
    expect(findKnownModelPricing("claude-sonnet-4-5-20250929")).not.toBeNull();
    expect(findKnownModelPricing("gpt-4o-mini")).not.toBeNull();
    expect(findKnownModelPricing("claude-haiku-4-6")).not.toBeNull();
    expect(findKnownModelPricing("gpt-5.3-codex-spark")).not.toBeNull();
    expect(findKnownModelPricing("gemini-2.5-flash")).not.toBeNull();
    expect(findKnownModelPricing("o1-mini")).not.toBeNull();
    expect(findKnownModelPricing("claude-haiku-4")).not.toBeNull();
  });
});

describe("estimateUsageCostUsd", () => {
  it("calculates usd from tokens", () => {
    const cost = estimateUsageCostUsd({
      model: "gpt-5",
      usage: { inputTokens: 1_000_000, cachedInputTokens: 500_000, outputTokens: 250_000 },
    });
    expect(cost).toBeCloseTo(3.1875, 5);
  });

  it("returns null when no pricing match exists", () => {
    expect(
      estimateUsageCostUsd({ model: "unknown-model", usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 } }),
    ).toBeNull();
  });
});
