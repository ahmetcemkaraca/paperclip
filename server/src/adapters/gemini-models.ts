import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { AdapterModel } from "./types.js";

const GEMINI_MODELS_CACHE_TTL_MS = 60_000;

let cached: { expiresAt: number; models: AdapterModel[] } | null = null;
let geminiCliRootOverride: string | null = null;

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

function titleCaseToken(token: string): string {
  if (/^\d+(\.\d+)*$/.test(token)) return token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function formatGeminiLabel(id: string): string {
  if (id === "auto") return "Auto";
  return id
    .split("-")
    .map((part, index) => (index === 0 ? "Gemini" : titleCaseToken(part)))
    .join(" ");
}

function resolveCommandPath(command: string): string | null {
  const result = spawnSync("which", [command], {
    encoding: "utf8",
    timeout: 2_000,
  });
  if ((result.status ?? 1) !== 0) return null;
  const resolved = result.stdout.trim();
  return resolved.length > 0 ? resolved : null;
}

function resolveGeminiCliRoot(): string | null {
  if (geminiCliRootOverride) return geminiCliRootOverride;

  const envOverride = process.env.PAPERCLIP_GEMINI_CLI_ROOT?.trim();
  if (envOverride) return envOverride;

  const commandPath = resolveCommandPath("gemini");
  if (!commandPath) return null;

  let realCommandPath = commandPath;
  try {
    realCommandPath = fs.realpathSync(commandPath);
  } catch {
    // Keep the unresolved path and try best-effort traversal below.
  }

  // e.g. /usr/lib/node_modules/@google/gemini-cli/dist/index.js -> package root
  return path.resolve(realCommandPath, "..", "..");
}

export function parseGeminiModelsSources(...sources: string[]): AdapterModel[] {
  const models: AdapterModel[] = [{ id: "auto", label: "Auto" }];

  for (const source of sources) {
    for (const match of source.matchAll(/\b(gemini-\d[\w.-]*)\b/g)) {
      const id = (match[1] ?? "").trim();
      if (!id) continue;
      if (id.includes("customtools")) continue;
      if (id.includes("embedding")) continue;
      models.push({ id, label: formatGeminiLabel(id) });
    }
  }

  return dedupeModels(models);
}

function loadGeminiModelsFromInstalledCli(): AdapterModel[] {
  const root = resolveGeminiCliRoot();
  if (!root) return [];

  const candidateFiles = [
    path.join(root, "node_modules", "@google", "gemini-cli-core", "dist", "src", "config", "models.js"),
    path.join(root, "node_modules", "@google", "gemini-cli-core", "dist", "src", "config", "defaultModelConfigs.js"),
  ];

  const sources: string[] = [];
  for (const candidate of candidateFiles) {
    try {
      sources.push(fs.readFileSync(candidate, "utf8"));
    } catch {
      // Ignore missing files and continue to other candidates.
    }
  }

  if (sources.length === 0) return [];
  return parseGeminiModelsSources(...sources);
}

export async function listGeminiModels(): Promise<AdapterModel[]> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.models;
  }

  const models = loadGeminiModelsFromInstalledCli();
  if (models.length > 0) {
    cached = {
      expiresAt: now + GEMINI_MODELS_CACHE_TTL_MS,
      models,
    };
    return models;
  }

  if (cached?.models.length) return cached.models;
  return [];
}

export function resetGeminiModelsCacheForTests() {
  cached = null;
}

export function setGeminiCliRootForTests(rootPath: string | null) {
  geminiCliRootOverride = rootPath;
}
