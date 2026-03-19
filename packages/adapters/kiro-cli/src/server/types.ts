// Type definitions for Kiro CLI adapter server module

/**
 * Kiro adapter configuration schema
 * Stored in agent.adapterConfig
 */
export interface KiroAdapterConfig {
  // Required
  cwd: string; // Absolute working directory

  // Optional core fields
  command?: string; // Default: "kiro"
  model?: string; // Model identifier
  promptTemplate?: string; // Prompt template with {{variables}}
  bootstrapPromptTemplate?: string; // Sent only for fresh sessions
  instructionsFilePath?: string; // Markdown instructions prepended to the prompt
  maxTurnsPerRun?: number; // Max conversation turns
  env?: Record<string, string>; // Environment variables
  extraArgs?: string[]; // Additional CLI arguments

  // Optional operational fields
  timeoutSec?: number; // Default: 0 (no timeout)
  graceSec?: number; // Default: 15
}

/**
 * Kiro session parameters
 * Persisted in agent_runtimes.sessionParams
 */
export interface KiroSessionParams {
  sessionId: string; // Kiro session identifier
  cwd: string; // Working directory
  workspaceId?: string; // Optional workspace ID
  repoUrl?: string; // Optional repository URL
  repoRef?: string; // Optional repository reference
}

/**
 * Kiro runtime configuration
 * Built from adapter config and execution context
 */
export interface KiroRuntimeConfig {
  command: string;
  cwd: string;
  workspaceId: string | null;
  workspaceRepoUrl: string | null;
  workspaceRepoRef: string | null;
  env: Record<string, string>;
  timeoutSec: number;
  graceSec: number;
  extraArgs: string[];
}
