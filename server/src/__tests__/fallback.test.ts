import { describe, expect, it } from "vitest";
import {
  containsRateLimitKeywords,
  detectRateLimitInResult,
  resolveFallbackConfig,
  shouldAttemptFallback,
} from "../services/fallback.js";
import { DEFAULT_RATE_LIMIT_KEYWORDS } from "@paperclipai/shared";
import type { AdapterExecutionResult } from "../adapters/index.js";

describe("Fallback rate-limit detection", () => {
  describe("containsRateLimitKeywords", () => {
    it("detects keywords case-insensitively", () => {
      expect(
        containsRateLimitKeywords("API Rate Limit Exceeded", ["rate limit"]),
      ).toBe(true);
      expect(
        containsRateLimitKeywords("api rate limit exceeded", ["RATE LIMIT"]),
      ).toBe(true);
    });

    it("returns false for non-matching text", () => {
      expect(
        containsRateLimitKeywords("Everything is fine", ["error"]),
      ).toBe(false);
    });

    it("handles empty keywords", () => {
      expect(containsRateLimitKeywords("rate limit", [])).toBe(false);
    });
  });

  describe("detectRateLimitInResult", () => {
    it("detects rate limit in error message", () => {
      const result: AdapterExecutionResult = {
        provider: "openai",
        model: "gpt-5",
        billingType: "api",
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: "Error: Rate limit exceeded",
        resultJson: {},
        usage: null,
        costUsd: null,
      };

      const detection = detectRateLimitInResult(result, DEFAULT_RATE_LIMIT_KEYWORDS);
      expect(detection.isRateLimit).toBe(true);
      expect(detection.detectedKeyword).toContain("rate limit");
    });

    it("detects rate limit in stdout", () => {
      const result: AdapterExecutionResult = {
        provider: "openai",
        model: "gpt-5",
        billingType: "api",
        exitCode: 0,
        signal: null,
        timedOut: false,
        errorMessage: null,
        resultJson: {
          stdout: "Usage limit exceeded. Please check your account.",
        },
        usage: null,
        costUsd: null,
      };

      const detection = detectRateLimitInResult(result, DEFAULT_RATE_LIMIT_KEYWORDS);
      expect(detection.isRateLimit).toBe(true);
    });

    it("detects throttling/quota keywords", () => {
      const result: AdapterExecutionResult = {
        provider: "anthropic",
        model: "claude-opus",
        billingType: "api",
        exitCode: 0,
        signal: null,
        timedOut: false,
        errorMessage: "Request throttled due to quota exceeded",
        resultJson: {},
        usage: null,
        costUsd: null,
      };

      const detection = detectRateLimitInResult(result, DEFAULT_RATE_LIMIT_KEYWORDS);
      expect(detection.isRateLimit).toBe(true);
    });

    it("returns false for normal execution", () => {
      const result: AdapterExecutionResult = {
        provider: "openai",
        model: "gpt-5",
        billingType: "api",
        exitCode: 0,
        signal: null,
        timedOut: false,
        errorMessage: null,
        resultJson: { stdout: "Task completed successfully" },
        usage: { inputTokens: 100, outputTokens: 200, cachedInputTokens: 0 },
        costUsd: 0.05,
      };

      const detection = detectRateLimitInResult(result, DEFAULT_RATE_LIMIT_KEYWORDS);
      expect(detection.isRateLimit).toBe(false);
      expect(detection.detectedKeyword).toBeNull();
    });

    it("supports custom keywords", () => {
      const result: AdapterExecutionResult = {
        provider: "openai",
        model: "gpt-5",
        billingType: "api",
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: "Custom error condition",
        resultJson: {},
        usage: null,
        costUsd: null,
      };

      const customKeywords = ["custom error"];
      const detection = detectRateLimitInResult(result, customKeywords);
      expect(detection.isRateLimit).toBe(true);
      expect(detection.detectedKeyword).toBe("custom error");
    });
  });

  describe("resolveFallbackConfig", () => {
    it("prioritizes agent-level fallback over company-level", () => {
      const agentConfig = {
        enabled: true,
        modelId: "gpt-5.2-codex",
      };

      const companyConfig = {
        enabled: true,
        modelId: "gpt-5",
      };

      const resolved = resolveFallbackConfig(agentConfig, companyConfig);
      expect(resolved?.modelId).toBe("gpt-5.2-codex");
    });

    it("falls back to company-level if agent config is disabled", () => {
      const agentConfig = {
        enabled: false,
      };

      const companyConfig = {
        enabled: true,
        modelId: "gpt-5",
      };

      const resolved = resolveFallbackConfig(agentConfig, companyConfig);
      expect(resolved?.modelId).toBe("gpt-5");
    });

    it("returns null if no fallback is enabled", () => {
      const agentConfig = { enabled: false };
      const resolved = resolveFallbackConfig(agentConfig, null);
      expect(resolved).toBeNull();
    });
  });

  describe("shouldAttemptFallback", () => {
    it("returns true when agent fallback is enabled and rate limit detected", () => {
      const agentConfig = { enabled: true, modelId: "gpt-5.2-codex" };
      const result: AdapterExecutionResult = {
        provider: "openai",
        model: "gpt-5",
        billingType: "api",
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: "Rate limit exceeded",
        resultJson: {},
        usage: null,
        costUsd: null,
      };

      const should = shouldAttemptFallback(agentConfig, null, result);
      expect(should).toBe(true);
    });

    it("returns false when no rate limit is detected", () => {
      const agentConfig = { enabled: true, modelId: "gpt-5.2-codex" };
      const result: AdapterExecutionResult = {
        provider: "openai",
        model: "gpt-5",
        billingType: "api",
        exitCode: 0,
        signal: null,
        timedOut: false,
        errorMessage: null,
        resultJson: { stdout: "Success" },
        usage: { inputTokens: 100, outputTokens: 200, cachedInputTokens: 0 },
        costUsd: 0.05,
      };

      const should = shouldAttemptFallback(agentConfig, null, result);
      expect(should).toBe(false);
    });

    it("attempts company-level fallback when agent fallback is disabled", () => {
      const agentConfig = { enabled: false };
      const companyConfig = { enabled: true, modelId: "gpt-5" };
      const result: AdapterExecutionResult = {
        provider: "openai",
        model: "gpt-5",
        billingType: "api",
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: "Usage limit exceeded",
        resultJson: {},
        usage: null,
        costUsd: null,
      };

      const should = shouldAttemptFallback(agentConfig, companyConfig, result);
      expect(should).toBe(true);
    });
  });
});
