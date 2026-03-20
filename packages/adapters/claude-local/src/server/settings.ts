import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseObject } from "@paperclipai/adapter-utils/server-utils";

type ClaudeSettings = {
  env?: Record<string, unknown>;
};

let cachedSettings: { loadedAt: number; settings: ClaudeSettings | null } | null = null;
const SETTINGS_CACHE_TTL_MS = 60_000;

function readEnvString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveSettingsPaths(): string[] {
  const home = os.homedir();
  return [
    path.join(home, ".claude", "settings.json"),
    path.join(home, ".claude.json"),
  ];
}

async function readSettingsFile(filePath: string): Promise<ClaudeSettings | null> {
  const raw = await fs.readFile(filePath, "utf8").catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parseObject(parsed) as ClaudeSettings;
  } catch {
    return null;
  }
}

export async function loadClaudeSettings(): Promise<ClaudeSettings | null> {
  if (cachedSettings && Date.now() - cachedSettings.loadedAt < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings.settings;
  }

  for (const filePath of resolveSettingsPaths()) {
    const settings = await readSettingsFile(filePath);
    if (settings) {
      cachedSettings = { loadedAt: Date.now(), settings };
      return settings;
    }
  }

  cachedSettings = { loadedAt: Date.now(), settings: null };
  return null;
}

export function resolveClaudeModelFromSettings(settings: ClaudeSettings | null | undefined): string | null {
  const env = settings?.env ?? {};
  return (
    readEnvString(env.ANTHROPIC_DEFAULT_MODEL) ??
    readEnvString(env.ANTHROPIC_DEFAULT_SONNET_MODEL) ??
    readEnvString(env.ANTHROPIC_DEFAULT_OPUS_MODEL) ??
    readEnvString(env.ANTHROPIC_DEFAULT_HAIKU_MODEL) ??
    null
  );
}
