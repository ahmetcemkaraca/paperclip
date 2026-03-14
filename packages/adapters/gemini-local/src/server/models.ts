import type { AdapterModel } from "@paperclipai/adapter-utils";
import { asString, runChildProcess } from "@paperclipai/adapter-utils/server-utils";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "../index.js";

const CACHE_TTL_MS = 60_000;

const FALLBACK_MODELS: AdapterModel[] = [
  { id: DEFAULT_GEMINI_LOCAL_MODEL, label: "Auto" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
];

let cache: { expiresAt: number; models: AdapterModel[] } | null = null;

function dedupeModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const out: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: model.label.trim() || id });
  }
  return out;
}

function sortModels(models: AdapterModel[]): AdapterModel[] {
  return [...models].sort((a, b) =>
    a.id.localeCompare(b.id, "en", { numeric: true, sensitivity: "base" }),
  );
}

function parseModelsFromText(stdout: string): AdapterModel[] {
  const tokens = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => line.split(/[\s,]+/));

  const matched = tokens
    .map((token) => token.replace(/^[-*•]\s*/, "").trim())
    .filter((token) => /^gemini-[a-z0-9][a-z0-9.-]*$/i.test(token));

  return dedupeModels(matched.map((id) => ({ id, label: id })));
}

function processEnvStrings(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

async function tryDiscover(command: string, args: string[]): Promise<AdapterModel[]> {
  try {
    const proc = await runChildProcess("gemini_list_models", command, args, {
      cwd: process.cwd(),
      env: processEnvStrings(process.env),
      timeoutSec: 8,
      graceSec: 2,
      onLog: async () => {},
    });
    if ((proc.exitCode ?? 1) !== 0) return [];
    return parseModelsFromText(proc.stdout);
  } catch {
    return [];
  }
}

export async function listGeminiModels(commandInput?: unknown): Promise<AdapterModel[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.models;

  const command = asString(commandInput, process.env.PAPERCLIP_GEMINI_COMMAND || "gemini");
  const candidates: string[][] = [
    ["models", "list"],
    ["--list-models"],
    ["models"],
  ];

  for (const args of candidates) {
    const discovered = await tryDiscover(command, args);
    if (discovered.length > 0) {
      const models = sortModels(dedupeModels([...FALLBACK_MODELS, ...discovered]));
      cache = { expiresAt: now + CACHE_TTL_MS, models };
      return models;
    }
  }

  const fallback = sortModels(dedupeModels(FALLBACK_MODELS));
  cache = { expiresAt: now + CACHE_TTL_MS, models: fallback };
  return fallback;
}

export function resetGeminiModelsCacheForTests() {
  cache = null;
}
