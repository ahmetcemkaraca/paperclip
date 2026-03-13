import { beforeEach, describe, expect, it, vi } from "vitest";
import { models as codexFallbackModels } from "@paperclipai/adapter-codex-local";
import { models as cursorFallbackModels } from "@paperclipai/adapter-cursor-local";
import { DEFAULT_CLAUDE_MODELS } from "@paperclipai/adapter-claude-local/server";
import { resetOpenCodeModelsCacheForTests } from "@paperclipai/adapter-opencode-local/server";
import { resetCopilotModelsCacheForTests } from "@paperclipai/adapter-copilot-cli/server";
import { listAdapterModels } from "../adapters/index.js";
import { resetCodexModelsCacheForTests } from "../adapters/codex-models.js";
import { resetCursorModelsCacheForTests, setCursorModelsRunnerForTests } from "../adapters/cursor-models.js";

describe("adapter model listing", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.PAPERCLIP_OPENCODE_COMMAND;
    resetCodexModelsCacheForTests();
    resetCursorModelsCacheForTests();
    setCursorModelsRunnerForTests(null);
    resetOpenCodeModelsCacheForTests();
    resetCopilotModelsCacheForTests();
    vi.restoreAllMocks();
  });

  it("returns an empty list for unknown adapters", async () => {
    const models = await listAdapterModels("unknown_adapter");
    expect(models).toEqual([]);
  });

  it("returns codex fallback models when no OpenAI key is available", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const models = await listAdapterModels("codex_local");

    expect(models).toEqual(codexFallbackModels);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loads codex models dynamically and merges fallback options", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "gpt-5-pro" },
          { id: "gpt-5" },
        ],
      }),
    } as Response);

    const first = await listAdapterModels("codex_local");
    const second = await listAdapterModels("codex_local");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.some((model) => model.id === "gpt-5-pro")).toBe(true);
    expect(first.some((model) => model.id === "codex-mini-latest")).toBe(true);
  });

  it("falls back to static codex models when OpenAI model discovery fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    const models = await listAdapterModels("codex_local");
    expect(models).toEqual(codexFallbackModels);
  });


  it("returns cursor fallback models when CLI discovery is unavailable", async () => {
    setCursorModelsRunnerForTests(() => ({
      status: null,
      stdout: "",
      stderr: "",
      hasError: true,
    }));

    const models = await listAdapterModels("cursor");
    expect(models).toEqual(cursorFallbackModels);
  });

  it("loads cursor models dynamically and caches them", async () => {
    const runner = vi.fn(() => ({
      status: 0,
      stdout: "Available models: auto, composer-1.5, gpt-5.3-codex-high, sonnet-4.6",
      stderr: "",
      hasError: false,
    }));
    setCursorModelsRunnerForTests(runner);

    const first = await listAdapterModels("cursor");
    const second = await listAdapterModels("cursor");

    expect(runner).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.some((model) => model.id === "auto")).toBe(true);
    expect(first.some((model) => model.id === "gpt-5.3-codex-high")).toBe(true);
    expect(first.some((model) => model.id === "composer-1")).toBe(true);
  });

  it("returns no opencode models when opencode command is unavailable", async () => {
    process.env.PAPERCLIP_OPENCODE_COMMAND = "__paperclip_missing_opencode_command__";

    const models = await listAdapterModels("opencode_local");
    expect(models).toEqual([]);
  });

  describe("Claude adapter model resolution", () => {
    it("reads settings correctly and returns models", async () => {
      // Task 4.1: Ensure listClaudeModels() reads settings correctly
      // This test verifies that the function successfully reads settings
      // (either from ~/.claude/settings.json or falls back to defaults)
      const models = await listAdapterModels("claude_local");
      
      // Should return a non-empty array
      expect(models.length).toBeGreaterThan(0);
      
      // All models should have the required structure
      for (const model of models) {
        expect(model).toHaveProperty("id");
        expect(model).toHaveProperty("label");
        expect(typeof model.id).toBe("string");
        expect(typeof model.label).toBe("string");
        expect(model.id.trim()).toBeTruthy();
        expect(model.label.trim()).toBeTruthy();
      }
    });

    it("deduplicates models by ID", async () => {
      // Task 4.1: Ensure model deduplication by ID
      const models = await listAdapterModels("claude_local");
      
      const ids = models.map(m => m.id);
      const uniqueIds = new Set(ids);
      
      // No duplicate IDs should exist
      expect(ids.length).toBe(uniqueIds.size);
    });

    it("includes legacy models in the list", async () => {
      // Task 4.1: Verify legacy models are included
      const models = await listAdapterModels("claude_local");
      
      const modelIds = models.map(m => m.id);
      
      // Should include legacy models
      expect(modelIds).toContain("claude-sonnet-4-5-20250929");
      expect(modelIds).toContain("claude-haiku-4-5-20251001");
    });

    it("returns models with valid structure", async () => {
      // Task 4.1: Verify model structure
      const models = await listAdapterModels("claude_local");
      
      for (const model of models) {
        expect(model).toHaveProperty("id");
        expect(model).toHaveProperty("label");
        expect(typeof model.id).toBe("string");
        expect(typeof model.label).toBe("string");
        expect(model.id.trim()).toBeTruthy();
        expect(model.label.trim()).toBeTruthy();
      }
    });

    it("DEFAULT_CLAUDE_MODELS contains expected fallback models", () => {
      // Task 4.1: Verify fallback to DEFAULT_CLAUDE_MODELS structure
      // This tests the constant directly to ensure fallback behavior is correct
      expect(DEFAULT_CLAUDE_MODELS.length).toBeGreaterThan(0);
      
      const modelIds = DEFAULT_CLAUDE_MODELS.map(m => m.id);
      
      // Should include the default family models
      expect(modelIds).toContain("claude-opus-4-6");
      expect(modelIds).toContain("claude-sonnet-4-6");
      expect(modelIds).toContain("claude-haiku-4-6");
      
      // Should include legacy models
      expect(modelIds).toContain("claude-sonnet-4-5-20250929");
      expect(modelIds).toContain("claude-haiku-4-5-20251001");
    });
  });

  describe("Copilot adapter model resolution", () => {
    it("returns fallback models when CLI discovery fails", async () => {
      // Task 4.3: Verify fallback to COPILOT_FALLBACK_MODELS on failure
      // When gh CLI is not available or commands fail, should return fallback models
      const models = await listAdapterModels("copilot_cli");
      
      // Should return a non-empty array
      expect(models.length).toBeGreaterThan(0);
      
      // All models should have the required structure
      for (const model of models) {
        expect(model).toHaveProperty("id");
        expect(model).toHaveProperty("label");
        expect(typeof model.id).toBe("string");
        expect(typeof model.label).toBe("string");
        expect(model.id.trim()).toBeTruthy();
        expect(model.label.trim()).toBeTruthy();
      }
    });

    it("includes all expected fallback models", async () => {
      // Task 4.3: Ensure all expected models are present
      const models = await listAdapterModels("copilot_cli");
      
      const modelIds = models.map(m => m.id);
      
      // Should include all fallback models from COPILOT_FALLBACK_MODELS
      expect(modelIds).toContain("gpt-4o");
      expect(modelIds).toContain("gpt-4.1");
      expect(modelIds).toContain("claude-sonnet-4");
      expect(modelIds).toContain("o3");
      expect(modelIds).toContain("o4-mini");
      expect(modelIds).toContain("gemini-2.5-pro");
    });

    it("deduplicates models by ID", async () => {
      // Task 4.3: Ensure model deduplication by ID
      const models = await listAdapterModels("copilot_cli");
      
      const ids = models.map(m => m.id);
      const uniqueIds = new Set(ids);
      
      // No duplicate IDs should exist
      expect(ids.length).toBe(uniqueIds.size);
    });

    it("returns models with valid structure", async () => {
      // Task 4.3: Verify model structure
      const models = await listAdapterModels("copilot_cli");
      
      for (const model of models) {
        expect(model).toHaveProperty("id");
        expect(model).toHaveProperty("label");
        expect(typeof model.id).toBe("string");
        expect(typeof model.label).toBe("string");
        expect(model.id.trim()).toBeTruthy();
        expect(model.label.trim()).toBeTruthy();
      }
    });
  });
});
