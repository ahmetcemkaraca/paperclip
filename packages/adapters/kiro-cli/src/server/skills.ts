import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import {
  ensurePaperclipSkillSymlink,
  listPaperclipSkillEntries,
  removeMaintainerOnlySkillSymlinks,
} from "@paperclipai/adapter-utils/server-utils";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function kiroSkillsHome() {
  return path.join(os.homedir(), ".kiro", "skills");
}

export async function ensureKiroSkillsInjected(
  onLog: AdapterExecutionContext["onLog"],
  skillsHome = kiroSkillsHome(),
) {
  const skillsEntries = await listPaperclipSkillEntries(__moduleDir);
  if (skillsEntries.length === 0) return;

  await fs.mkdir(skillsHome, { recursive: true });
  const removedSkills = await removeMaintainerOnlySkillSymlinks(
    skillsHome,
    skillsEntries.map((entry) => entry.name),
  );
  for (const name of removedSkills) {
    await onLog("stdout", `[paperclip] Removed maintainer-only Kiro skill "${name}" from ${skillsHome}\n`);
  }

  for (const entry of skillsEntries) {
    const target = path.join(skillsHome, entry.name);
    try {
      const result = await ensurePaperclipSkillSymlink(entry.source, target);
      if (result === "skipped") continue;
      await onLog(
        "stdout",
        `[paperclip] ${result === "repaired" ? "Repaired" : "Injected"} Kiro skill "${entry.name}" into ${skillsHome}\n`,
      );
    } catch (error) {
      await onLog(
        "stderr",
        `[paperclip] Failed to inject Kiro skill "${entry.name}" into ${skillsHome}: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }
}
