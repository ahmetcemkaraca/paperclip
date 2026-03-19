import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AdapterModel } from "./types.js";

const CODEX_MODELS_CACHE_TTL_MS = 60_000;

type CodexModelCacheEntry = {
  slug?: unknown;
  display_name?: unknown;
  visibility?: unknown;
};

let cached: { cachePath: string; expiresAt: number; models: AdapterModel[] } | null = null;
let codexModelsCachePathOverride: string | null = null;

function dedupeModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const deduped: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({ id, label: model.label.trim() || id });
  }
  return deduped;
}

function resolveCodexModelsCachePath(): string {
  if (codexModelsCachePathOverride) return codexModelsCachePathOverride;

  const envOverride = process.env.PAPERCLIP_CODEX_MODELS_CACHE_PATH?.trim();
  if (envOverride) return envOverride;

  const codexHome = process.env.CODEX_HOME?.trim();
  if (codexHome) {
    return path.join(codexHome, "models_cache.json");
  }

  return path.join(os.homedir(), ".codex", "models_cache.json");
}

export function parseCodexModelsCache(source: string): AdapterModel[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return [];
  }

  const entries = Array.isArray((parsed as { models?: unknown }).models)
    ? ((parsed as { models: unknown[] }).models as CodexModelCacheEntry[])
    : [];

  const models: AdapterModel[] = [];
  for (const entry of entries) {
    const id = typeof entry.slug === "string" ? entry.slug.trim() : "";
    const label = typeof entry.display_name === "string" ? entry.display_name.trim() : id;
    const visibility = typeof entry.visibility === "string" ? entry.visibility.trim() : "";
    if (!id) continue;
    if (visibility && visibility !== "list") continue;
    models.push({ id, label: label || id });
  }

  return dedupeModels(models);
}

function loadCodexModelsFromCacheFile(): { cachePath: string; models: AdapterModel[] } {
  const cachePath = resolveCodexModelsCachePath();
  let source: string;
  try {
    source = fs.readFileSync(cachePath, "utf8");
  } catch {
    return { cachePath, models: [] };
  }

  return {
    cachePath,
    models: parseCodexModelsCache(source),
  };
}

export async function listCodexModels(): Promise<AdapterModel[]> {
  const now = Date.now();
  const cachePath = resolveCodexModelsCachePath();
  if (cached && cached.cachePath === cachePath && cached.expiresAt > now) {
    return cached.models;
  }

  const loaded = loadCodexModelsFromCacheFile();
  if (loaded.models.length > 0) {
    cached = {
      cachePath: loaded.cachePath,
      expiresAt: now + CODEX_MODELS_CACHE_TTL_MS,
      models: loaded.models,
    };
    return loaded.models;
  }

  if (cached && cached.cachePath === cachePath && cached.models.length > 0) {
    return cached.models;
  }

  return [];
}

export function resetCodexModelsCacheForTests() {
  cached = null;
}

export function setCodexModelsCachePathForTests(filePath: string | null) {
  codexModelsCachePathOverride = filePath;
}
