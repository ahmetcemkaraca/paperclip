import type { UsageSummary } from "./types.js";

export interface TokenPricePerMillion {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

type ModelPricingEntry = {
  pricing: TokenPricePerMillion;
  source: "openai" | "anthropic" | "cursor" | "opencode";
};

const EXACT_MODEL_PRICING = new Map<string, ModelPricingEntry>([
  ["auto", { pricing: { inputUsdPerMillion: 1.25, cachedInputUsdPerMillion: 0.25, outputUsdPerMillion: 6 }, source: "cursor" }],
  ["codex-mini-latest", { pricing: { inputUsdPerMillion: 1.5, cachedInputUsdPerMillion: 0.375, outputUsdPerMillion: 6 }, source: "openai" }],
  ["gpt-5", { pricing: { inputUsdPerMillion: 1.25, cachedInputUsdPerMillion: 0.125, outputUsdPerMillion: 10 }, source: "openai" }],
  ["gpt-5-codex", { pricing: { inputUsdPerMillion: 1.25, cachedInputUsdPerMillion: 0.125, outputUsdPerMillion: 10 }, source: "openai" }],
  ["gpt-5-mini", { pricing: { inputUsdPerMillion: 0.25, cachedInputUsdPerMillion: 0.025, outputUsdPerMillion: 2 }, source: "openai" }],
  ["gpt-5-nano", { pricing: { inputUsdPerMillion: 0.05, cachedInputUsdPerMillion: 0.005, outputUsdPerMillion: 0.4 }, source: "openai" }],
  ["gpt-5.1", { pricing: { inputUsdPerMillion: 1.25, cachedInputUsdPerMillion: 0.125, outputUsdPerMillion: 10 }, source: "openai" }],
  ["gpt-5.1-codex", { pricing: { inputUsdPerMillion: 1.25, cachedInputUsdPerMillion: 0.125, outputUsdPerMillion: 10 }, source: "openai" }],
  ["gpt-5.1-codex-max", { pricing: { inputUsdPerMillion: 1.25, cachedInputUsdPerMillion: 0.125, outputUsdPerMillion: 10 }, source: "openai" }],
  ["gpt-5.1-codex-max-high", { pricing: { inputUsdPerMillion: 1.25, cachedInputUsdPerMillion: 0.125, outputUsdPerMillion: 10 }, source: "openai" }],
  ["gpt-5.1-codex-mini", { pricing: { inputUsdPerMillion: 0.25, cachedInputUsdPerMillion: 0.025, outputUsdPerMillion: 2 }, source: "openai" }],
  ["gpt-5.2", { pricing: { inputUsdPerMillion: 1.75, cachedInputUsdPerMillion: 0.175, outputUsdPerMillion: 14 }, source: "openai" }],
  ["gpt-5.2-codex", { pricing: { inputUsdPerMillion: 1.75, cachedInputUsdPerMillion: 0.175, outputUsdPerMillion: 14 }, source: "openai" }],
  ["gpt-5.3-codex", { pricing: { inputUsdPerMillion: 1.75, cachedInputUsdPerMillion: 0.175, outputUsdPerMillion: 14 }, source: "openai" }],
  ["gpt-5.3-codex-spark", { pricing: { inputUsdPerMillion: 1.75, cachedInputUsdPerMillion: 0.175, outputUsdPerMillion: 14 }, source: "openai" }],
  ["gpt-5.4", { pricing: { inputUsdPerMillion: 2.5, cachedInputUsdPerMillion: 0.25, outputUsdPerMillion: 15 }, source: "openai" }],
  ["gpt-4o", { pricing: { inputUsdPerMillion: 2.5, cachedInputUsdPerMillion: 0.375, outputUsdPerMillion: 15 }, source: "openai" }],
  ["gpt-4o-mini", { pricing: { inputUsdPerMillion: 0.15, cachedInputUsdPerMillion: 0.075, outputUsdPerMillion: 0.6 }, source: "openai" }],
  ["o1", { pricing: { inputUsdPerMillion: 15, cachedInputUsdPerMillion: 7.5, outputUsdPerMillion: 60 }, source: "openai" }],
  ["o1-mini", { pricing: { inputUsdPerMillion: 1.1, cachedInputUsdPerMillion: 0.55, outputUsdPerMillion: 4.4 }, source: "openai" }],
  ["o3", { pricing: { inputUsdPerMillion: 2, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 8 }, source: "openai" }],
  ["o3-mini", { pricing: { inputUsdPerMillion: 1.1, cachedInputUsdPerMillion: 0.55, outputUsdPerMillion: 4.4 }, source: "openai" }],
  ["o4-mini", { pricing: { inputUsdPerMillion: 1.1, cachedInputUsdPerMillion: 0.275, outputUsdPerMillion: 4.4 }, source: "openai" }],
  ["claude-haiku-3-5", { pricing: { inputUsdPerMillion: 0.8, cachedInputUsdPerMillion: 0.08, outputUsdPerMillion: 4 }, source: "anthropic" }],
  ["claude-haiku-4-5", { pricing: { inputUsdPerMillion: 1, cachedInputUsdPerMillion: 0.1, outputUsdPerMillion: 5 }, source: "anthropic" }],
  ["claude-haiku-4-5-20251001", { pricing: { inputUsdPerMillion: 1, cachedInputUsdPerMillion: 0.1, outputUsdPerMillion: 5 }, source: "anthropic" }],
  ["claude-haiku-4-6", { pricing: { inputUsdPerMillion: 1, cachedInputUsdPerMillion: 0.1, outputUsdPerMillion: 5 }, source: "anthropic" }],
  ["claude-haiku-4", { pricing: { inputUsdPerMillion: 1, cachedInputUsdPerMillion: 0.1, outputUsdPerMillion: 5 }, source: "anthropic" }],
  ["claude-opus-4", { pricing: { inputUsdPerMillion: 15, cachedInputUsdPerMillion: 1.5, outputUsdPerMillion: 75 }, source: "anthropic" }],
  ["claude-opus-4-1", { pricing: { inputUsdPerMillion: 15, cachedInputUsdPerMillion: 1.5, outputUsdPerMillion: 75 }, source: "anthropic" }],
  ["claude-opus-4-5", { pricing: { inputUsdPerMillion: 5, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 25 }, source: "anthropic" }],
  ["claude-opus-4-6", { pricing: { inputUsdPerMillion: 5, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 25 }, source: "anthropic" }],
  ["claude-sonnet-4", { pricing: { inputUsdPerMillion: 3, cachedInputUsdPerMillion: 0.3, outputUsdPerMillion: 15 }, source: "anthropic" }],
  ["claude-sonnet-4-5", { pricing: { inputUsdPerMillion: 3, cachedInputUsdPerMillion: 0.3, outputUsdPerMillion: 15 }, source: "anthropic" }],
  ["claude-sonnet-4-5-20250929", { pricing: { inputUsdPerMillion: 3, cachedInputUsdPerMillion: 0.3, outputUsdPerMillion: 15 }, source: "anthropic" }],
  ["claude-sonnet-4-6", { pricing: { inputUsdPerMillion: 3, cachedInputUsdPerMillion: 0.3, outputUsdPerMillion: 15 }, source: "anthropic" }],
  ["gemini-3-flash", { pricing: { inputUsdPerMillion: 0.4, cachedInputUsdPerMillion: 0.1, outputUsdPerMillion: 3 }, source: "opencode" }],
  ["gemini-3-pro", { pricing: { inputUsdPerMillion: 2.5, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 15 }, source: "opencode" }],
  ["gemini-3.1-pro", { pricing: { inputUsdPerMillion: 2.5, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 15 }, source: "opencode" }],
  ["gemini-2.5-pro", { pricing: { inputUsdPerMillion: 1.25, cachedInputUsdPerMillion: 0.125, outputUsdPerMillion: 10 }, source: "opencode" }],
  ["gemini-2.5-flash", { pricing: { inputUsdPerMillion: 0.3, cachedInputUsdPerMillion: 0.075, outputUsdPerMillion: 2.5 }, source: "opencode" }],
  ["gemini-2.5-flash-lite", { pricing: { inputUsdPerMillion: 0.1, cachedInputUsdPerMillion: 0.01, outputUsdPerMillion: 0.4 }, source: "opencode" }],
  ["gemini-2.0-flash", { pricing: { inputUsdPerMillion: 0.075, cachedInputUsdPerMillion: 0.01875, outputUsdPerMillion: 0.3 }, source: "opencode" }],
  ["gemini-2.0-flash-lite", { pricing: { inputUsdPerMillion: 0.075, cachedInputUsdPerMillion: 0.01875, outputUsdPerMillion: 0.3 }, source: "opencode" }],
]);

const OPENAI_VARIANT_RE = /^(gpt-5(?:\.\d+)?(?:-codex)?(?:-spark)?)(?:-(?:low|high|xhigh|fast|preview))+$/;

function normalizeModelId(rawModel: string | null | undefined): string {
  return (rawModel ?? "").trim().toLowerCase();
}

function stripProviderPrefix(rawModel: string): string {
  const slash = rawModel.indexOf("/");
  return slash < 0 ? rawModel : rawModel.slice(slash + 1);
}

export function findKnownModelPricing(rawModel: string | null | undefined): ModelPricingEntry | null {
  const normalized = normalizeModelId(rawModel);
  if (!normalized) return null;

  const direct = EXACT_MODEL_PRICING.get(normalized);
  if (direct) return direct;

  const unscoped = stripProviderPrefix(normalized);
  const scopedDirect = EXACT_MODEL_PRICING.get(unscoped);
  if (scopedDirect) return scopedDirect;

  const variant = unscoped.match(OPENAI_VARIANT_RE);
  if (variant) return EXACT_MODEL_PRICING.get(variant[1]) ?? null;

  if (/^gpt-5(?:\.\d+)?(?:-codex)?(?:-spark)?$/.test(unscoped)) {
    return EXACT_MODEL_PRICING.get(unscoped) ?? null;
  }

  const geminiVariant = unscoped.match(/^(gemini-(?:2\.5|2\.0)-(?:pro|flash|flash-lite))(?:-.+)?$/);
  if (geminiVariant) return EXACT_MODEL_PRICING.get(geminiVariant[1]) ?? null;

  if (/^o1(?:-mini)?$/.test(unscoped)) {
    return EXACT_MODEL_PRICING.get("o3") ?? null;
  }

  if (unscoped.endsWith("-thinking")) {
    return EXACT_MODEL_PRICING.get(unscoped.slice(0, -"thinking".length - 1)) ?? null;
  }

  return null;
}

export function estimateUsageCostUsd(input: {
  model: string | null | undefined;
  usage: UsageSummary | null | undefined;
}): number | null {
  const pricing = findKnownModelPricing(input.model);
  const usage = input.usage;
  if (!pricing || !usage) return null;

  const inputTokens = Math.max(0, Math.floor(usage.inputTokens || 0));
  const cachedInputTokens = Math.max(0, Math.floor(usage.cachedInputTokens || 0));
  const outputTokens = Math.max(0, Math.floor(usage.outputTokens || 0));
  if (inputTokens <= 0 && cachedInputTokens <= 0 && outputTokens <= 0) return null;

  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const usd =
    (uncachedInputTokens / 1_000_000) * pricing.pricing.inputUsdPerMillion +
    (cachedInputTokens / 1_000_000) * pricing.pricing.cachedInputUsdPerMillion +
    (outputTokens / 1_000_000) * pricing.pricing.outputUsdPerMillion;
  return Number.isFinite(usd) ? usd : null;
}
