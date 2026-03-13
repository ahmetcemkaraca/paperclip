import { describe, expect, it } from "vitest";
import { estimateUsageCostUsd } from "@paperclipai/adapter-utils";

describe("adapter pricing helper", () => {
  it("prices codex/openai usage with cached input tokens discounted", () => {
    const cost = estimateUsageCostUsd({
      model: "gpt-5.3-codex",
      usage: {
        inputTokens: 1_000_000,
        cachedInputTokens: 200_000,
        outputTokens: 100_000,
      },
    });

    expect(cost).toBeCloseTo(2.835, 6);
  });

  it("matches provider-prefixed opencode models", () => {
    const cost = estimateUsageCostUsd({
      model: "openai/o4-mini",
      usage: {
        inputTokens: 500_000,
        cachedInputTokens: 100_000,
        outputTokens: 50_000,
      },
    });

    expect(cost).toBeCloseTo(0.6875, 6);
  });

  it("maps cursor fast/high suffixes back to the published base model price", () => {
    const cost = estimateUsageCostUsd({
      model: "gpt-5.2-codex-high-fast",
      usage: {
        inputTokens: 100_000,
        cachedInputTokens: 25_000,
        outputTokens: 10_000,
      },
    });

    expect(cost).toBeCloseTo(0.275625, 6);
  });
});
