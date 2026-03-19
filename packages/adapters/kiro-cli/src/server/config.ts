// Configuration extraction and validation for Kiro CLI adapter

import path from "node:path";
import {
  asString,
  asNumber,
  asStringArray,
  parseObject,
} from "@paperclipai/adapter-utils/server-utils";
import type { KiroAdapterConfig, KiroRuntimeConfig } from "./types.js";

/**
 * Extract and validate Kiro adapter configuration from raw config object
 * 
 * @param config - Raw configuration object from agent.adapterConfig
 * @returns Validated KiroAdapterConfig
 * @throws Error if required fields are missing or invalid
 */
export function extractConfig(config: unknown): KiroAdapterConfig {
  const obj = parseObject(config);

  // Extract required field: cwd
  const cwd = asString(obj.cwd, "");
  if (!cwd) {
    throw new Error('Configuration error: "cwd" is required');
  }

  // Validate cwd is an absolute path
  if (!path.isAbsolute(cwd)) {
    throw new Error(`Configuration error: "cwd" must be an absolute path, got: "${cwd}"`);
  }

  // Extract optional core fields
  const command = asString(obj.command, "kiro-cli");
  const model = obj.model ? asString(obj.model, "") : undefined;
  const promptTemplate = obj.promptTemplate ? asString(obj.promptTemplate, "") : undefined;
  const maxTurnsPerRun = obj.maxTurnsPerRun ? asNumber(obj.maxTurnsPerRun, 0) : undefined;
  
  // Extract optional environment variables
  const envRaw = obj.env;
  let env: Record<string, string> | undefined;
  if (envRaw !== undefined && envRaw !== null) {
    const envObj = parseObject(envRaw);
    env = {};
    for (const [key, value] of Object.entries(envObj)) {
      env[key] = asString(value, "");
    }
  }

  // Extract optional extra arguments
  const extraArgs = obj.extraArgs ? asStringArray(obj.extraArgs) : undefined;

  // Extract optional operational fields
  const timeoutSec = obj.timeoutSec !== undefined ? asNumber(obj.timeoutSec, 0) : undefined;
  const graceSec = obj.graceSec !== undefined ? asNumber(obj.graceSec, 15) : undefined;

  return {
    cwd,
    command,
    model,
    promptTemplate,
    maxTurnsPerRun,
    env,
    extraArgs,
    timeoutSec,
    graceSec,
  };
}

/**
 * Build runtime configuration from adapter config and execution context
 * 
 * @param config - Validated adapter configuration
 * @param context - Additional context for runtime configuration
 * @returns KiroRuntimeConfig ready for process execution
 */
export function buildRuntimeConfig(
  config: KiroAdapterConfig,
  context: {
    workspaceId?: string | null;
    workspaceRepoUrl?: string | null;
    workspaceRepoRef?: string | null;
    env?: Record<string, string>;
  } = {}
): KiroRuntimeConfig {
  return {
    command: config.command ?? "kiro-cli",
    cwd: config.cwd,
    workspaceId: context.workspaceId ?? null,
    workspaceRepoUrl: context.workspaceRepoUrl ?? null,
    workspaceRepoRef: context.workspaceRepoRef ?? null,
    env: {
      ...(config.env ?? {}),
      ...(context.env ?? {}),
    },
    timeoutSec: config.timeoutSec ?? 0,
    graceSec: config.graceSec ?? 15,
    extraArgs: config.extraArgs ?? [],
  };
}

/**
 * Validate that a path exists (for use in environment testing)
 * 
 * @param targetPath - Path to validate
 * @returns Error message if invalid, null if valid
 */
export function validatePathExists(targetPath: string): string | null {
  if (!path.isAbsolute(targetPath)) {
    return `Path must be absolute: "${targetPath}"`;
  }
  
  // Note: Actual existence check is done asynchronously in testEnvironment
  // This function only validates the path format
  return null;
}
