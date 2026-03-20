import { describe, it, expect } from "vitest";
import { computeCostCents, type ComputeCostInput, type ModelPriceData } from "./model-prices.js";

describe("computeCostCents", () => {
  it("should compute cost for input tokens only", () => {
    const input: ComputeCostInput = {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cachedInputTokens: 0,
    };
    const price: ModelPriceData = {
      inputCostPerMillion: 300, // $3.00/1M
      outputCostPerMillion: 0,
      cachedInputCostPerMillion: 0,
    };

    const result = computeCostCents(input, price);

    expect(result).toBe(300); // 1M * 300 / 1M = 300 cents
  });

  it("should compute cost for output tokens only", () => {
    const input: ComputeCostInput = {
      inputTokens: 0,
      outputTokens: 1_000_000,
      cachedInputTokens: 0,
    };
    const price: ModelPriceData = {
      inputCostPerMillion: 0,
      outputCostPerMillion: 600, // $6.00/1M
      cachedInputCostPerMillion: 0,
    };

    const result = computeCostCents(input, price);

    expect(result).toBe(600); // 1M * 600 / 1M = 600 cents
  });

  it("should compute cost for mixed tokens", () => {
    const input: ComputeCostInput = {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      cachedInputTokens: 0,
    };
    const price: ModelPriceData = {
      inputCostPerMillion: 300, // $3.00/1M
      outputCostPerMillion: 600, // $6.00/1M
      cachedInputCostPerMillion: 0,
    };

    const result = computeCostCents(input, price);

    // (1M * 300 + 500k * 600) / 1M = (300M + 300M) / 1M = 600 cents
    expect(result).toBe(600);
  });

  it("should compute cost with cached input tokens", () => {
    const input: ComputeCostInput = {
      inputTokens: 500_000,
      outputTokens: 0,
      cachedInputTokens: 500_000,
    };
    const price: ModelPriceData = {
      inputCostPerMillion: 300, // $3.00/1M
      outputCostPerMillion: 0,
      cachedInputCostPerMillion: 30, // $0.30/1M (discounted)
    };

    const result = computeCostCents(input, price);

    // (500k * 300 + 500k * 30) / 1M = (150M + 15M) / 1M = 165 cents
    expect(result).toBe(165);
  });

  it("should round to nearest cent", () => {
    const input: ComputeCostInput = {
      inputTokens: 333_333,
      outputTokens: 0,
      cachedInputTokens: 0,
    };
    const price: ModelPriceData = {
      inputCostPerMillion: 100, // $1.00/1M
      outputCostPerMillion: 0,
      cachedInputCostPerMillion: 0,
    };

    const result = computeCostCents(input, price);

    // (333333 * 100) / 1M = 33.3333 → rounds to 33
    expect(result).toBe(33);
  });

  it("should return 0 for zero tokens", () => {
    const input: ComputeCostInput = {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
    };
    const price: ModelPriceData = {
      inputCostPerMillion: 300,
      outputCostPerMillion: 600,
      cachedInputCostPerMillion: 30,
    };

    const result = computeCostCents(input, price);

    expect(result).toBe(0);
  });

  it("should return 0 for zero prices", () => {
    const input: ComputeCostInput = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cachedInputTokens: 1_000_000,
    };
    const price: ModelPriceData = {
      inputCostPerMillion: 0,
      outputCostPerMillion: 0,
      cachedInputCostPerMillion: 0,
    };

    const result = computeCostCents(input, price);

    expect(result).toBe(0);
  });
});
