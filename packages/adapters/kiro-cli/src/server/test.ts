import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
} from "@paperclipai/adapter-utils/server-utils";
import { extractConfig } from "./config.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];

  try {
    const config = extractConfig(ctx.config);

    try {
      await ensureAbsoluteDirectory(config.cwd, { createIfMissing: false });
      checks.push({
        code: "cwd_valid",
        level: "info",
        message: `Working directory is valid: ${config.cwd}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push({
        code: message.includes("absolute path") ? "relative_cwd" : "invalid_cwd",
        level: "error",
        message,
        detail: config.cwd,
      });
    }

    const runtimeEnv = ensurePathInEnv({
      ...process.env,
      ...(config.env ?? {}),
    });

    try {
      await ensureCommandResolvable(config.command ?? "kiro-cli", config.cwd, runtimeEnv);
      checks.push({
        code: "command_resolvable",
        level: "info",
        message: `Command is executable: ${config.command ?? "kiro-cli"}`,
      });
    } catch (error) {
      checks.push({
        code: "command_not_found",
        level: "error",
        message: error instanceof Error ? error.message : "Command is not executable",
        detail: config.command ?? "kiro-cli",
        hint: "Install Kiro CLI and use the full path if your server PATH does not include it.",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      code: message.includes("absolute path") ? "relative_cwd" : "invalid_cwd",
      level: "error",
      message,
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
