import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { AdapterModel } from "./types.js";

const CLAUDE_MODELS_CACHE_TTL_MS = 60_000;

let cached: { expiresAt: number; models: AdapterModel[] } | null = null;
let claudeCliPathOverride: string | null = null;

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

function resolveCommandPath(command: string): string | null {
  const result = spawnSync("which", [command], {
    encoding: "utf8",
    timeout: 2_000,
  });
  if ((result.status ?? 1) !== 0) return null;
  const resolved = result.stdout.trim();
  return resolved.length > 0 ? resolved : null;
}

function resolveClaudeCliPath(): string | null {
  if (claudeCliPathOverride) return claudeCliPathOverride;

  const envOverride = process.env.PAPERCLIP_CLAUDE_CLI_JS?.trim();
  if (envOverride) return envOverride;

  const commandPath = resolveCommandPath("claude");
  if (!commandPath) return null;

  try {
    return fs.realpathSync(commandPath);
  } catch {
    return commandPath;
  }
}

export function parseClaudeModelsSource(source: string): AdapterModel[] {
  const models: AdapterModel[] = [];

  for (const match of source.matchAll(/\|\s*(Claude [^|]+?)\s*\|\s*`(claude-[a-z0-9.-]+)`/gi)) {
    const label = (match[1] ?? "").trim();
    const id = (match[2] ?? "").trim();
    if (!id) continue;
    models.push({ id, label });
  }

  for (const match of source.matchAll(/`(claude-[a-z0-9.-]+)`/gi)) {
    const id = (match[1] ?? "").trim();
    if (!id) continue;
    models.push({ id, label: id });
  }

  return dedupeModels(models);
}

function loadClaudeModelsFromCliBundle(): AdapterModel[] {
  const cliPath = resolveClaudeCliPath();
  if (!cliPath) return [];

  let source: string;
  try {
    source = fs.readFileSync(cliPath, "utf8");
  } catch {
    return [];
  }

  const parsed = parseClaudeModelsSource(source);
  return parsed.filter((model) => model.id.startsWith("claude-"));
}

export async function listClaudeModels(): Promise<AdapterModel[]> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.models;
  }

  const models = loadClaudeModelsFromCliBundle();
  if (models.length > 0) {
    cached = {
      expiresAt: now + CLAUDE_MODELS_CACHE_TTL_MS,
      models,
    };
    return models;
  }

  if (cached?.models.length) return cached.models;
  return [];
}

export function resetClaudeModelsCacheForTests() {
  cached = null;
}

export function setClaudeCliPathForTests(filePath: string | null) {
  claudeCliPathOverride = filePath;
}

export function resolveClaudeCliDirForTests(): string | null {
  const cliPath = resolveClaudeCliPath();
  return cliPath ? path.dirname(cliPath) : null;
}
