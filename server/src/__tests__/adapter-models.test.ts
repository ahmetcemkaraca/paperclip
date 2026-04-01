import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { models as codexFallbackModels } from "@paperclipai/adapter-codex-local";
import { models as cursorFallbackModels } from "@paperclipai/adapter-cursor-local";
import { models as opencodeFallbackModels } from "@paperclipai/adapter-opencode-local";
import { resetOpenCodeModelsCacheForTests } from "@paperclipai/adapter-opencode-local/server";
import { listAdapterModels } from "../adapters/index.js";
import {
  resetClaudeModelsCacheForTests,
  setClaudeCliPathForTests,
} from "../adapters/claude-models.js";
import {
  resetCodexModelsCacheForTests,
  setCodexModelsCachePathForTests,
} from "../adapters/codex-models.js";
import { resetCursorModelsCacheForTests, setCursorModelsRunnerForTests } from "../adapters/cursor-models.js";
import {
  resetGeminiModelsCacheForTests,
  setGeminiCliRootForTests,
} from "../adapters/gemini-models.js";

describe("adapter model listing", () => {
  beforeEach(() => {
    delete process.env.PAPERCLIP_OPENCODE_COMMAND;
    resetClaudeModelsCacheForTests();
    setClaudeCliPathForTests(null);
    resetCodexModelsCacheForTests();
    setCodexModelsCachePathForTests(null);
    resetCursorModelsCacheForTests();
    setCursorModelsRunnerForTests(null);
    resetGeminiModelsCacheForTests();
    setGeminiCliRootForTests(null);
    resetOpenCodeModelsCacheForTests();
    vi.restoreAllMocks();
  });

  it("returns an empty list for unknown adapters", async () => {
    const models = await listAdapterModels("unknown_adapter");
    expect(models).toEqual([]);
  });

  it("returns static claude models when CLI discovery is unavailable", async () => {
    setClaudeCliPathForTests(path.join(os.tmpdir(), "paperclip-missing-claude-cli.js"));
    const models = await listAdapterModels("claude_local");

    expect(models.some((model) => model.id === "claude-opus-4-6")).toBe(true);
    expect(models.some((model) => model.id === "claude-sonnet-4-6")).toBe(true);
  });

  it("loads claude models dynamically from the installed CLI bundle", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-claude-models-"));
    const cliPath = path.join(dir, "cli.js");
    await fs.writeFile(
      cliPath,
      [
        "| Claude Opus 4.6   | `claude-opus-4-6`   | Active |",
        "| Claude Sonnet 4.6 | `claude-sonnet-4-6` | Active |",
        "| Claude Haiku 4.5  | `claude-haiku-4-5`  | Active |",
      ].join("\n"),
    );
    setClaudeCliPathForTests(cliPath);

    const models = await listAdapterModels("claude_local");
    expect(models).toEqual([
      { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ]);
  });

  it("returns static codex models when the CLI cache is unavailable", async () => {
    setCodexModelsCachePathForTests(path.join(os.tmpdir(), "paperclip-missing-codex-models-cache.json"));
    const models = await listAdapterModels("codex_local");

    expect(models).toEqual(codexFallbackModels);
  });

  it("loads codex models dynamically from the CLI cache", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-codex-models-"));
    const cachePath = path.join(dir, "models_cache.json");
    await fs.writeFile(
      cachePath,
      JSON.stringify({
        models: [
          { slug: "gpt-5.4", display_name: "gpt-5.4", visibility: "list" },
          { slug: "gpt-5.2-codex", display_name: "GPT-5.2 Codex", visibility: "list" },
          { slug: "hidden-model", display_name: "hidden-model", visibility: "hidden" },
        ],
      }),
    );
    setCodexModelsCachePathForTests(cachePath);

    const first = await listAdapterModels("codex_local");
    const second = await listAdapterModels("codex_local");

    expect(first).toEqual(second);
    expect(first).toEqual([
      { id: "gpt-5.4", label: "gpt-5.4" },
      { id: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
    ]);
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

  it("returns opencode fallback models including gpt-5.4", async () => {
    process.env.PAPERCLIP_OPENCODE_COMMAND = "__paperclip_missing_opencode_command__";

    const models = await listAdapterModels("opencode_local");

    expect(models).toEqual(opencodeFallbackModels);
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
    expect(first.some((model) => model.id === "composer-1.5")).toBe(true);
  });

  it("returns static gemini models when CLI discovery is unavailable", async () => {
    setGeminiCliRootForTests(path.join(os.tmpdir(), "paperclip-missing-gemini-cli-root"));
    const models = await listAdapterModels("gemini_local");

    expect(models.some((model) => model.id === "auto")).toBe(true);
    expect(models.some((model) => model.id === "gemini-2.5-pro")).toBe(true);
  });

  it("loads gemini models dynamically from the installed CLI package", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-gemini-models-"));
    const configDir = path.join(root, "node_modules", "@google", "gemini-cli-core", "dist", "src", "config");
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, "models.js"),
      [
        "export const PREVIEW_GEMINI_MODEL = 'gemini-3-pro-preview';",
        "export const PREVIEW_GEMINI_FLASH_MODEL = 'gemini-3-flash-preview';",
        "export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';",
        "export const DEFAULT_GEMINI_FLASH_MODEL = 'gemini-2.5-flash';",
        "export const DEFAULT_GEMINI_FLASH_LITE_MODEL = 'gemini-2.5-flash-lite';",
      ].join("\n"),
    );
    await fs.writeFile(
      path.join(configDir, "defaultModelConfigs.js"),
      [
        "export const DEFAULT_MODEL_CONFIGS = {",
        "  aliases: {",
        "    'gemini-3.1-pro-preview': { modelConfig: { model: 'gemini-3.1-pro-preview' } },",
        "    'gemini-3.1-flash-lite-preview': { modelConfig: { model: 'gemini-3.1-flash-lite-preview' } },",
        "  },",
        "};",
      ].join("\n"),
    );
    setGeminiCliRootForTests(root);

    const models = await listAdapterModels("gemini_local");
    expect(models.some((model) => model.id === "auto")).toBe(true);
    expect(models.some((model) => model.id === "gemini-3-pro-preview")).toBe(true);
    expect(models.some((model) => model.id === "gemini-3-flash-preview")).toBe(true);
    expect(models.some((model) => model.id === "gemini-2.5-pro")).toBe(true);
    expect(models.some((model) => model.id === "gemini-3.1-pro-preview")).toBe(true);
    expect(models.some((model) => model.id === "gemini-3.1-flash-lite-preview")).toBe(true);
  });

});
