export const type = "opencode_local";
export const label = "OpenCode (local)";

export const models: Array<{ id: string; label: string }> = [
  { id: "anthropic/claude-sonnet-4-6", label: "anthropic/claude-sonnet-4-6" },
  { id: "anthropic/claude-opus-4-6", label: "anthropic/claude-opus-4-6" },
  { id: "openai/gpt-5.4", label: "openai/gpt-5.4" },
  { id: "openai/gpt-5.3-codex", label: "openai/gpt-5.3-codex" },
  { id: "openai/gpt-5.2-codex", label: "openai/gpt-5.2-codex" },
  { id: "openai/o3", label: "openai/o3" },
  { id: "openai/o4-mini", label: "openai/o4-mini" },
  { id: "opencode/claude-sonnet-4-5", label: "opencode/claude-sonnet-4-5" },
  { id: "opencode/claude-opus-4-1", label: "opencode/claude-opus-4-1" },
  { id: "opencode/gemini-3-pro", label: "opencode/gemini-3-pro" },
  { id: "opencode/gemini-3-flash", label: "opencode/gemini-3-flash" },
];

export const agentConfigurationDoc = `# opencode_local agent configuration

Adapter: opencode_local

Use when:
- You want Paperclip to run OpenCode locally as the agent runtime
- You want provider/model routing in OpenCode format (provider/model)
- You want OpenCode session resume across heartbeats via --session

Don't use when:
- You need webhook-style external invocation (use openclaw_gateway or http)
- You only need one-shot shell commands (use process)
- OpenCode CLI is not installed on the machine

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the run prompt
- model (string, required): OpenCode model id in provider/model format (for example anthropic/claude-sonnet-4-5)
- variant (string, optional): provider-specific model variant (for example minimal|low|medium|high|max)
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "opencode"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- OpenCode supports multiple providers and models. Use \
  \`opencode models\` to list available options in provider/model format.
- Paperclip requires an explicit \`model\` value for \`opencode_local\` agents.
- Runs are executed with: opencode run --format json ...
- Sessions are resumed with --session when stored session cwd matches current cwd.
- Paperclip computes \`costUsd\` from OpenCode's emitted cost when available, or falls back to published per-token pricing for known provider/model combinations.
`;
