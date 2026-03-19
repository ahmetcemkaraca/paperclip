export const type = "kiro_cli";
export const label = "Kiro CLI";

export const models = [
  { id: "claude-opus-4", label: "Claude Opus 4" },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "claude-haiku-4", label: "Claude Haiku 4" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "o1", label: "OpenAI o1" },
  { id: "o1-mini", label: "OpenAI o1-mini" },
];

export const agentConfigurationDoc = `# kiro_cli agent configuration

Adapter: kiro_cli

Use when:
- You want Paperclip to run Kiro CLI locally through the documented ACP protocol
- You want session resume across heartbeats so the agent keeps its Kiro conversation history
- You want Kiro to discover Paperclip skills from the standard Kiro global skills directory

Don't use when:
- You only need one-shot shell execution with no conversational state (use process)
- You need a webhook or remote callback runtime (use http or openclaw_gateway)
- Kiro CLI is not installed on the machine running Paperclip

Core fields:
- cwd (string, required): absolute working directory for the Kiro ACP session
- command (string, optional): defaults to "kiro-cli"
- model (string, optional): model identifier for Kiro to use
- promptTemplate (string, optional): run prompt template with variable substitution
- maxTurnsPerRun (number, optional): maximum conversation turns per run
- env (object, optional): KEY=VALUE environment variables
- extraArgs (string[], optional): additional CLI arguments
- instructionsFilePath (string, optional): absolute markdown file prepended to the prompt on each run
- bootstrapPromptTemplate (string, optional): prompt section sent only for fresh sessions

Operational fields:
- timeoutSec (number, optional): run timeout in seconds (default: 0 = no timeout)
- graceSec (number, optional): SIGTERM grace period in seconds (default: 15)

Notes:
- PAPERCLIP_* environment variables are automatically injected at runtime
- PAPERCLIP_API_KEY is injected through the process environment, never the prompt
- Sessions persist across runs using Kiro ACP session ids when the saved cwd still matches
- Paperclip injects shared skills into "~/.kiro/skills" without touching the agent cwd
- Kiro is invoked as "kiro-cli acp", then Paperclip drives initialize/session/new|load/session/prompt over JSON-RPC

Example:
\`\`\`json
{
  "cwd": "/abs/path/to/repo",
  "command": "kiro-cli",
  "model": "claude-sonnet-4",
  "promptTemplate": "You are {{agent.name}}. Continue work on {{context.taskId}}.",
  "timeoutSec": 1800,
  "graceSec": 15
}
\`\`\`
`;
