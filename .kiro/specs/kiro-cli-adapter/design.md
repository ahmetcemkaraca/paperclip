# Design Document: Kiro CLI Adapter

## Overview

The Kiro CLI adapter integrates Kiro, an AI-powered IDE and coding assistant, into Paperclip's adapter ecosystem. This adapter enables Paperclip agents to execute development work using Kiro's autonomous capabilities, including code editing, file system operations, and development workflow management.

The adapter follows Paperclip's established three-module architecture:
- **Server module**: Executes Kiro processes, manages sessions, and handles runtime configuration
- **UI module**: Parses Kiro output into structured transcripts and provides configuration forms
- **CLI module**: Formats Kiro events for terminal display during `paperclipai run --watch`

The design leverages patterns from existing adapters (particularly claude-local) while accommodating Kiro-specific features like session persistence, skills injection, and output formatting.

## Architecture

### Package Structure

```
packages/adapters/kiro-cli/
├── src/
│   ├── index.ts              # Adapter metadata and exports
│   ├── server/
│   │   ├── index.ts          # Server module exports
│   │   ├── execute.ts        # Core execution logic
│   │   ├── parse.ts          # Output parsing utilities
│   │   └── test.ts           # Environment testing
│   ├── ui/
│   │   ├── index.ts          # UI module exports
│   │   ├── parse-stdout.ts   # Transcript parsing
│   │   └── build-config.ts   # Config builder
│   └── cli/
│       ├── index.ts          # CLI module exports
│       └── format-event.ts   # Terminal output formatting
├── package.json
└── tsconfig.json
```

### Module Boundaries

The adapter maintains strict separation between execution contexts:

1. **Server module** (`./server`): Runs in the Paperclip server process with access to file system, child process spawning, and environment variables. Handles all execution logic and session management.

2. **UI module** (`./ui`): Runs in the browser with no Node.js APIs. Parses stdout lines into structured transcript entries for display in the run detail viewer.

3. **CLI module** (`./cli`): Runs in the CLI process with access to terminal output. Formats events for human-readable console display with colors.

### Registry Integration

The adapter registers in three locations:

- `server/src/adapters/registry.ts`: Server-side execution
- `ui/src/adapters/registry.ts`: UI transcript parsing and config forms
- `cli/src/adapters/registry.ts`: CLI output formatting

Each registry imports the appropriate module path (`./server`, `./ui`, or `./cli`) to avoid pulling in incompatible dependencies.

## Components and Interfaces

### Adapter Metadata (src/index.ts)

```typescript
export const type = "kiro_cli";
export const label = "Kiro CLI";

export const models = [
  { id: "claude-opus-4", label: "Claude Opus 4" },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  // Additional models as supported by Kiro
];

export const agentConfigurationDoc = `# kiro_cli agent configuration

Adapter: kiro_cli

Core fields:
- cwd (string, required): absolute working directory for the Kiro process
- command (string, optional): defaults to "kiro"
- model (string, optional): model identifier for Kiro to use
- promptTemplate (string, optional): run prompt template with variable substitution
- maxTurnsPerRun (number, optional): maximum conversation turns per run
- env (object, optional): KEY=VALUE environment variables
- extraArgs (string[], optional): additional CLI arguments

Operational fields:
- timeoutSec (number, optional): run timeout in seconds (default: 0 = no timeout)
- graceSec (number, optional): SIGTERM grace period in seconds (default: 15)

Use when:
- Agent needs autonomous code editing and file system operations
- Agent requires IDE-like capabilities (refactoring, navigation, diagnostics)
- Agent benefits from Kiro's development workflow features

Don't use when:
- Simple API calls or data processing tasks (use API adapters)
- Gateway-based execution is required (use openclaw-gateway)
- Specific IDE integration is needed (use cursor-local, claude-local)
`;
```

### Server Module Interface

#### Execute Function

```typescript
export async function execute(
  ctx: AdapterExecutionContext
): Promise<AdapterExecutionResult>
```

The execute function:
1. Extracts configuration from `ctx.config`
2. Builds runtime environment with PAPERCLIP_* variables
3. Renders prompt template with context variables
4. Attempts to resume existing session if available
5. Spawns Kiro process with appropriate arguments
6. Streams stdout/stderr via `ctx.onLog`
7. Parses output to extract usage, session state, and results
8. Returns structured execution result

#### Session Codec

```typescript
export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw: unknown): Record<string, unknown> | null,
  serialize(params: Record<string, unknown> | null): Record<string, unknown> | null,
  getDisplayId(params: Record<string, unknown> | null): string | null
};
```

Session parameters structure:
```typescript
{
  sessionId: string,      // Kiro session identifier
  cwd: string,            // Working directory for session validation
  workspaceId?: string,   // Optional workspace identifier
  repoUrl?: string,       // Optional repository URL
  repoRef?: string        // Optional repository reference
}
```

#### Test Environment Function

```typescript
export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext
): Promise<AdapterEnvironmentTestResult>
```

Validation checks:
- Command resolvability in PATH
- Working directory existence and absoluteness
- Configuration validity
- Optional: Kiro version probe

### UI Module Interface

#### Parse Stdout Line

```typescript
export function parseKiroStdoutLine(
  line: string,
  ts: string
): TranscriptEntry[]
```

Kiro output format (JSON lines):
```json
{"type": "init", "sessionId": "abc123", "model": "claude-opus-4"}
{"type": "assistant", "content": "I'll help you with that."}
{"type": "tool_call", "name": "readFile", "input": {"path": "src/index.ts"}}
{"type": "tool_result", "toolUseId": "xyz", "content": "...", "isError": false}
{"type": "result", "usage": {"inputTokens": 100, "outputTokens": 50}, "costUsd": 0.01}
```

Transcript entry types:
- `init`: Session initialization
- `assistant`: Assistant response text
- `tool_call`: Tool invocation
- `tool_result`: Tool execution result
- `result`: Final result with usage stats
- `stdout`: Unparseable lines (fallback)

#### Build Config

```typescript
export function buildKiroConfig(
  values: CreateConfigValues
): Record<string, unknown>
```

Converts UI form values to adapter config JSON:
```typescript
{
  cwd: string,
  command: string,
  model: string,
  promptTemplate: string,
  maxTurnsPerRun: number,
  timeoutSec: number,
  graceSec: number,
  env: Record<string, string>,
  extraArgs: string[]
}
```

### CLI Module Interface

#### Format Stdout Event

```typescript
export function formatKiroStdoutEvent(
  line: string,
  debug: boolean
): void
```

Terminal output formatting:
- System messages: blue
- Assistant messages: green
- Tool calls: yellow
- Tool results: gray (debug mode)
- Errors: red
- Usage stats: blue

## Data Models

### Adapter Configuration Schema

```typescript
interface KiroAdapterConfig {
  // Required
  cwd: string;                          // Absolute working directory
  
  // Optional core fields
  command?: string;                     // Default: "kiro"
  model?: string;                       // Model identifier
  promptTemplate?: string;              // Prompt template with {{variables}}
  maxTurnsPerRun?: number;             // Max conversation turns
  env?: Record<string, string>;        // Environment variables
  extraArgs?: string[];                // Additional CLI arguments
  
  // Optional operational fields
  timeoutSec?: number;                 // Default: 0 (no timeout)
  graceSec?: number;                   // Default: 15
}
```

### Session Parameters Schema

```typescript
interface KiroSessionParams {
  sessionId: string;                   // Kiro session identifier
  cwd: string;                         // Working directory
  workspaceId?: string;                // Optional workspace ID
  repoUrl?: string;                    // Optional repository URL
  repoRef?: string;                    // Optional repository reference
}
```

### Execution Context

```typescript
interface KiroExecutionContext {
  runId: string;
  agent: {
    id: string;
    companyId: string;
    name: string;
    adapterType: string;
    adapterConfig: unknown;
  };
  runtime: {
    sessionId: string | null;
    sessionParams: Record<string, unknown> | null;
    sessionDisplayId: string | null;
    taskKey: string | null;
  };
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
  onMeta?: (meta: AdapterInvocationMeta) => Promise<void>;
  authToken?: string;
}
```

### Execution Result

```typescript
interface KiroExecutionResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  errorMessage?: string | null;
  errorCode?: string | null;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  };
  sessionId?: string | null;
  sessionParams?: Record<string, unknown> | null;
  sessionDisplayId?: string | null;
  provider?: string | null;
  model?: string | null;
  costUsd?: number | null;
  summary?: string | null;
  clearSession?: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies:

- Properties 3.7 and 11.6 both test timeout behavior (consolidated into Property 3)
- Properties 3.8 and 14.2 both test non-zero exit code error handling (consolidated into Property 4)
- Properties 12.1-12.6 all test result field population (consolidated into Property 11)
- Properties 13.2-13.4 all test conditional skills injection strategies (consolidated into Property 12)

### Property 1: Configuration Extraction

*For any* AdapterExecutionContext with valid configuration fields, extracting configuration values should successfully parse cwd, command, model, and promptTemplate without errors.

**Validates: Requirements 3.1**

### Property 2: Environment Variable Injection

*For any* execution context, the spawned Kiro process should receive PAPERCLIP_AGENT_ID, PAPERCLIP_COMPANY_ID, PAPERCLIP_API_URL, PAPERCLIP_RUN_ID, and PAPERCLIP_API_KEY environment variables.

**Validates: Requirements 3.2**

### Property 3: Timeout Enforcement

*For any* Kiro execution with timeoutSec > 0, if the process exceeds the timeout, the result should have timedOut set to true and the process should be terminated.

**Validates: Requirements 3.7, 11.2, 11.6**

### Property 4: Non-Zero Exit Code Error Handling

*For any* Kiro process that exits with a non-zero exit code, the execution result should contain a populated errorMessage field describing the failure.

**Validates: Requirements 3.8, 14.2**

### Property 5: Template Rendering

*For any* prompt template and execution context, rendering the template should substitute variables including agentId, companyId, runId, agent, and context.

**Validates: Requirements 3.3**

### Property 6: Output Logging

*For any* Kiro process output (stdout or stderr), the adapter should call onLog with the correct stream identifier and content chunk.

**Validates: Requirements 3.4**

### Property 7: Session Resumption

*For any* execution context with existing session parameters where the session cwd matches the current config cwd, the adapter should attempt to resume the existing session.

**Validates: Requirements 4.2, 4.3**

### Property 8: Session State Extraction

*For any* successful Kiro run that outputs session information, the execution result should contain sessionParams with sessionId and cwd fields populated.

**Validates: Requirements 4.5**

### Property 9: Configuration Defaults

*For any* CreateConfigValues with missing optional fields, buildConfig should populate timeoutSec and graceSec with sensible default values.

**Validates: Requirements 5.5**

### Property 10: Path Validation

*For any* adapter configuration, if cwd is not an absolute path or does not exist, the execute function should return an error before spawning a process.

**Validates: Requirements 5.6, 8.2**

### Property 11: Usage and Cost Extraction

*For any* Kiro output containing usage statistics and cost information, the execution result should populate usage.inputTokens, usage.outputTokens, usage.cachedInputTokens, costUsd, provider, and model fields.

**Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**

### Property 12: Skills Injection Without CWD Pollution

*For any* Kiro execution, Paperclip skills should be discoverable to Kiro, but the agent's cwd should not contain any skills files or symlinks after execution completes.

**Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6**

### Property 13: Transcript Parsing

*For any* valid Kiro JSON output line, parseStdoutLine should return an array of TranscriptEntry objects with appropriate kind fields (init, assistant, tool_call, tool_result, result, or stdout).

**Validates: Requirements 6.1, 6.3, 6.4, 6.5, 6.6, 6.7**

### Property 14: Unparseable Line Fallback

*For any* unparseable or non-JSON stdout line, parseStdoutLine should return a TranscriptEntry with kind "stdout" containing the raw text.

**Validates: Requirements 6.7**

### Property 15: CLI Formatting Without Errors

*For any* Kiro stdout line, formatStdoutEvent should execute without throwing errors, regardless of whether the line is parseable.

**Validates: Requirements 7.1**

### Property 16: Debug Mode Output Suppression

*For any* unrecognized Kiro output line, when debug mode is disabled, formatStdoutEvent should not produce any console output.

**Validates: Requirements 7.6**

### Property 17: Command Resolvability Check

*For any* adapter configuration, testEnvironment should validate that the configured command is resolvable in PATH and return an appropriate check result.

**Validates: Requirements 8.1**

### Property 18: Environment Test Failure Aggregation

*For any* set of environment checks, if any check has level "error", testEnvironment should return status "fail".

**Validates: Requirements 8.7**

### Property 19: API Key Security

*For any* execution context, PAPERCLIP_API_KEY should be injected via environment variables and should not appear in the rendered prompt template.

**Validates: Requirements 9.1**

### Property 20: Sensitive Environment Variable Redaction

*For any* onMeta call, sensitive environment variables (including API keys and tokens) should be redacted using redactEnvForLogs before logging.

**Validates: Requirements 9.2**

### Property 21: User Environment Variable Pass-Through

*For any* user-provided environment variables in the adapter config, those variables should be passed to the Kiro process but their values should not appear in logged metadata.

**Validates: Requirements 9.6**

### Property 22: Parse Failure Raw Output Inclusion

*For any* Kiro execution where output parsing fails, the execution result should include raw stdout and stderr in the resultJson field.

**Validates: Requirements 14.3**

### Property 23: Error Type Differentiation

*For any* execution failure, the errorMessage should clearly differentiate between timeout errors, process errors, and parse failures based on the failure type.

**Validates: Requirements 14.5**

### Property 24: Machine-Readable Error Codes

*For any* known error condition (command not found, invalid cwd, timeout, auth required), the execution result should populate errorCode with a machine-readable identifier.

**Validates: Requirements 14.6**

## Error Handling

### Error Categories

The adapter handles four primary error categories:

1. **Configuration Errors**: Invalid or missing configuration values
   - Invalid cwd (not absolute, doesn't exist)
   - Command not resolvable in PATH
   - Invalid timeout/grace period values
   - Error codes: `invalid_cwd`, `relative_cwd`, `command_not_found`

2. **Execution Errors**: Process-level failures
   - Non-zero exit codes
   - Process signals (SIGTERM, SIGKILL)
   - Timeout exceeded
   - Error codes: `timeout`, `process_error`, `signal_<name>`

3. **Session Errors**: Session management failures
   - Unknown session ID
   - Session cwd mismatch
   - Session deserialization failure
   - Error codes: `unknown_session`, `session_cwd_mismatch`

4. **Parse Errors**: Output parsing failures
   - Malformed JSON output
   - Missing required fields
   - Unexpected output format
   - Error codes: `parse_error`, `invalid_output`

### Error Recovery Strategies

**Session Recovery**: When a session resume fails with "unknown session" error:
1. Log the failure to stderr
2. Retry execution with a fresh session
3. Set `clearSession: true` in the result
4. Continue with the new session

**Timeout Recovery**: When a process times out:
1. Send SIGTERM to the process
2. Wait for graceSec period
3. Send SIGKILL if process hasn't exited
4. Return result with `timedOut: true`
5. Include partial output in resultJson

**Parse Failure Recovery**: When output parsing fails:
1. Return result with non-zero exitCode
2. Include raw stdout/stderr in resultJson
3. Set errorMessage describing parse failure
4. Set errorCode to `parse_error`

### Error Message Format

Error messages follow a consistent format:
- Configuration errors: `"Invalid <field>: <reason>"`
- Execution errors: `"Kiro exited with code <code>: <stderr_line>"`
- Session errors: `"Session <id> is unavailable: <reason>"`
- Parse errors: `"Failed to parse Kiro output: <reason>"`

### Logging Strategy

The adapter logs errors at appropriate levels:
- Configuration validation errors: Logged before process spawn
- Execution errors: Logged via onLog to stderr stream
- Session errors: Logged via onLog with `[paperclip]` prefix
- Parse errors: Included in errorMessage field

## Testing Strategy

### Dual Testing Approach

The Kiro adapter requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific configuration examples (valid and invalid)
- Known error conditions (command not found, invalid cwd)
- Edge cases (empty output, malformed JSON)
- Integration points (module exports, registry registration)

**Property-Based Tests** focus on:
- Universal properties across all inputs (configuration extraction, environment injection)
- Randomized configuration values (paths, timeouts, environment variables)
- Output parsing across varied JSON structures
- Session management across different session states

### Property-Based Testing Configuration

The adapter uses **fast-check** (JavaScript/TypeScript property-based testing library) with the following configuration:

- Minimum 100 iterations per property test
- Each test tagged with: `Feature: kiro-cli-adapter, Property <number>: <property_text>`
- Generators for:
  - Valid/invalid file paths
  - Configuration objects with optional fields
  - Kiro JSON output structures
  - Environment variable maps
  - Session parameter objects

### Test Organization

```
packages/adapters/kiro-cli/
├── src/
│   └── __tests__/
│       ├── server/
│       │   ├── execute.test.ts          # Unit tests for execution logic
│       │   ├── execute.property.test.ts # Property tests for execution
│       │   ├── parse.test.ts            # Unit tests for parsing
│       │   ├── parse.property.test.ts   # Property tests for parsing
│       │   └── test.test.ts             # Unit tests for environment testing
│       ├── ui/
│       │   ├── parse-stdout.test.ts     # Unit tests for transcript parsing
│       │   └── parse-stdout.property.test.ts # Property tests for parsing
│       └── cli/
│           └── format-event.test.ts     # Unit tests for CLI formatting
```

### Example Property Test

```typescript
// Feature: kiro-cli-adapter, Property 2: Environment Variable Injection
test('spawned process receives PAPERCLIP_* environment variables', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        agentId: fc.uuid(),
        companyId: fc.uuid(),
        runId: fc.uuid(),
        apiUrl: fc.webUrl(),
        apiKey: fc.hexaString({ minLength: 32, maxLength: 64 })
      }),
      async (context) => {
        const result = await execute({
          runId: context.runId,
          agent: {
            id: context.agentId,
            companyId: context.companyId,
            name: 'test-agent',
            adapterType: 'kiro_cli',
            adapterConfig: {}
          },
          runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
          config: { cwd: '/tmp', command: 'echo' },
          context: {},
          onLog: async () => {},
          authToken: context.apiKey
        });
        
        // Verify environment variables were injected
        expect(result.env).toHaveProperty('PAPERCLIP_AGENT_ID', context.agentId);
        expect(result.env).toHaveProperty('PAPERCLIP_COMPANY_ID', context.companyId);
        expect(result.env).toHaveProperty('PAPERCLIP_RUN_ID', context.runId);
        expect(result.env).toHaveProperty('PAPERCLIP_API_KEY', context.apiKey);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Test Coverage Requirements

Minimum coverage targets:
- Server module: 80% line coverage, 70% branch coverage
- UI module: 85% line coverage, 75% branch coverage
- CLI module: 70% line coverage, 60% branch coverage

Critical paths requiring 100% coverage:
- Configuration validation
- Session codec serialization/deserialization
- Error code assignment
- Security-sensitive operations (API key handling, env var redaction)

## Security Considerations

### API Key Handling

**Storage**: API keys are never stored in adapter configuration. They are provided via:
- `authToken` parameter in AdapterExecutionContext (runtime injection)
- Environment variables on the host system (for local development)

**Transmission**: API keys are passed to Kiro via environment variables:
```typescript
env.PAPERCLIP_API_KEY = authToken;
```

**Logging**: API keys are redacted from all logged output:
- `onMeta` calls use `redactEnvForLogs` to strip sensitive variables
- Prompt templates never include API keys
- Error messages never include API keys

**Validation**: The adapter validates that:
- API keys are not present in prompt templates
- API keys are not logged to stdout/stderr
- API keys are not included in resultJson

### Environment Variable Security

**User-Provided Variables**: User-configured environment variables (via `config.env`) are:
- Passed to the Kiro process without modification
- Not logged in their entirety (keys logged, values redacted)
- Validated for type safety (must be string key-value pairs)

**System Variables**: Paperclip-injected variables (PAPERCLIP_*) are:
- Generated at runtime from trusted sources
- Never sourced from user input
- Redacted in logs based on naming patterns

**Redaction Strategy**:
```typescript
const SENSITIVE_ENV_PATTERNS = [
  /API_KEY$/i,
  /TOKEN$/i,
  /SECRET$/i,
  /PASSWORD$/i,
  /PAPERCLIP_API_KEY/
];

function redactEnvForLogs(env: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (SENSITIVE_ENV_PATTERNS.some(pattern => pattern.test(key))) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}
```

### Output Sanitization

**Untrusted Input**: All Kiro output is treated as untrusted:
- JSON parsing uses safe parsers (no `eval`)
- String extraction uses type guards (`asString`, `asNumber`)
- Array iteration validates element types
- Object access uses optional chaining

**Injection Prevention**: The adapter prevents injection attacks:
- No shell command construction from Kiro output
- No file path construction from Kiro output without validation
- No dynamic code execution based on Kiro output

**Error Message Safety**: Error messages never include:
- Full file system paths (use relative paths or redact home directory)
- API keys or tokens
- Sensitive environment variable values
- Raw user input without sanitization

### Process Isolation

**Working Directory**: The adapter enforces working directory constraints:
- Must be an absolute path
- Must exist or be creatable
- Cannot be system directories (/, /etc, /usr, etc.)
- Validated before process spawn

**Process Limits**: The adapter enforces resource limits:
- Timeout enforcement (SIGTERM → SIGKILL)
- Grace period for cleanup
- No unbounded process execution

**Cleanup**: The adapter ensures cleanup:
- Temporary directories removed in finally blocks
- Skills symlinks removed after execution
- No persistent state in file system

### Skills Injection Security

**Isolation**: Paperclip skills are injected without polluting the agent's working directory:
- Skills placed in temporary directory
- Temporary directory outside agent's cwd
- Symlinks used (no file copies)
- Cleanup guaranteed via finally block

**Validation**: Skills directory validation:
- Verify skills directory exists before symlinking
- Validate symlink targets are within skills directory
- Prevent symlink attacks (no following symlinks during validation)

**Permissions**: Skills have read-only access:
- Symlinks are read-only
- No write access to skills directory
- Skills cannot modify Paperclip code

## Integration Points

### Paperclip Server Integration

**Adapter Registry**: The adapter registers in `server/src/adapters/registry.ts`:
```typescript
import * as kiroCliAdapter from '@paperclipai/adapter-kiro-cli/server';

export const ADAPTERS: Record<string, ServerAdapterModule> = {
  // ... other adapters
  kiro_cli: kiroCliAdapter,
};
```

**Execution Flow**:
1. Server receives agent run request
2. Server looks up adapter by `agent.adapterType`
3. Server calls `adapter.execute(ctx)`
4. Adapter spawns Kiro process
5. Adapter streams output via `ctx.onLog`
6. Adapter returns execution result
7. Server persists result to database

**Session Management**:
1. Server loads `runtime.sessionParams` from database
2. Server passes session params to adapter via `ctx.runtime`
3. Adapter deserializes session params via `sessionCodec.deserialize`
4. Adapter attempts session resumption
5. Adapter returns new session params in result
6. Server persists session params via `sessionCodec.serialize`

### Paperclip UI Integration

**Adapter Registry**: The adapter registers in `ui/src/adapters/registry.ts`:
```typescript
import * as kiroCliAdapter from '@paperclipai/adapter-kiro-cli/ui';

export const UI_ADAPTERS: Record<string, UIAdapterModule> = {
  // ... other adapters
  kiro_cli: {
    parseStdoutLine: kiroCliAdapter.parseKiroStdoutLine,
    buildConfig: kiroCliAdapter.buildKiroConfig,
  },
};
```

**Transcript Display**:
1. UI fetches run logs from server
2. UI splits logs into lines
3. UI calls `parseStdoutLine` for each line
4. UI renders TranscriptEntry components
5. UI displays structured transcript in run detail view

**Configuration Form**:
1. UI renders agent configuration form
2. UI calls `buildConfig` when form is submitted
3. UI sends config JSON to server
4. Server stores config in `agent.adapterConfig`

### Paperclip CLI Integration

**Adapter Registry**: The adapter registers in `cli/src/adapters/registry.ts`:
```typescript
import * as kiroCliAdapter from '@paperclipai/adapter-kiro-cli/cli';

export const CLI_ADAPTERS: Record<string, CLIAdapterModule> = {
  // ... other adapters
  kiro_cli: {
    type: 'kiro_cli',
    formatStdoutEvent: kiroCliAdapter.formatKiroStdoutEvent,
  },
};
```

**Watch Mode Output**:
1. CLI runs `paperclipai run --watch`
2. CLI streams logs from server
3. CLI calls `formatStdoutEvent` for each line
4. CLI prints colored output to terminal
5. CLI continues until run completes

### Adapter Utils Integration

The adapter depends on `@paperclipai/adapter-utils` for shared utilities:

**Type Imports**:
- `AdapterExecutionContext`
- `AdapterExecutionResult`
- `AdapterSessionCodec`
- `AdapterEnvironmentTestContext`
- `AdapterEnvironmentTestResult`
- `TranscriptEntry`

**Server Utils**:
- `asString`, `asNumber`, `asBoolean`: Safe type extraction
- `parseObject`, `parseJson`: Safe parsing
- `buildPaperclipEnv`: Environment variable construction
- `renderTemplate`: Template rendering with variable substitution
- `redactEnvForLogs`: Sensitive data redaction
- `ensureAbsoluteDirectory`: Path validation
- `ensureCommandResolvable`: Command validation
- `runChildProcess`: Process spawning with timeout

**Session Utils**:
- Session compaction policies (if applicable)
- Session management interfaces

### Skills Directory Resolution

The adapter resolves the Paperclip skills directory using multiple strategies:

**Published Package**:
```
@paperclipai/adapter-kiro-cli/
├── dist/
│   └── server/
│       └── execute.js
└── skills/              # Symlinked or copied during build
    └── paperclip-api/
```

**Development**:
```
repo/
├── packages/adapters/kiro-cli/
│   └── src/server/
│       └── execute.ts
└── skills/              # Repo root skills directory
    └── paperclip-api/
```

**Resolution Logic**:
```typescript
const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_CANDIDATES = [
  path.resolve(__moduleDir, '../../skills'),         // published
  path.resolve(__moduleDir, '../../../../../skills'), // dev
];

async function resolvePaperclipSkillsDir(): Promise<string | null> {
  for (const candidate of SKILLS_CANDIDATES) {
    const isDir = await fs.stat(candidate)
      .then(s => s.isDirectory())
      .catch(() => false);
    if (isDir) return candidate;
  }
  return null;
}
```

## Implementation Notes

### Kiro CLI Output Format

The adapter assumes Kiro outputs JSON lines to stdout in the following format:

**Session Initialization**:
```json
{"type": "init", "sessionId": "abc123", "model": "claude-opus-4", "timestamp": "2024-01-01T00:00:00Z"}
```

**Assistant Response**:
```json
{"type": "assistant", "content": "I'll help you with that task.", "timestamp": "2024-01-01T00:00:01Z"}
```

**Tool Call**:
```json
{"type": "tool_call", "name": "readFile", "input": {"path": "src/index.ts"}, "toolUseId": "tool_123", "timestamp": "2024-01-01T00:00:02Z"}
```

**Tool Result**:
```json
{"type": "tool_result", "toolUseId": "tool_123", "content": "file contents...", "isError": false, "timestamp": "2024-01-01T00:00:03Z"}
```

**Final Result**:
```json
{"type": "result", "sessionId": "abc123", "usage": {"inputTokens": 100, "outputTokens": 50, "cachedInputTokens": 20}, "costUsd": 0.01, "summary": "Task completed successfully", "timestamp": "2024-01-01T00:00:04Z"}
```

If Kiro's actual output format differs, the parser will need adjustment.

### Session Persistence Strategy

Sessions are persisted in the `agent_runtimes` table:
- `sessionParams`: JSON blob with session state
- `sessionDisplayId`: Human-readable session identifier

Session validation logic:
1. Check if `sessionParams.cwd` matches current `config.cwd`
2. If mismatch, start fresh session (different working directory)
3. If match, attempt resume with `sessionParams.sessionId`
4. If resume fails, retry with fresh session and set `clearSession: true`

### Template Variable Substitution

The adapter supports Mustache-style template variables:

**Available Variables**:
- `{{agentId}}`: Agent ID
- `{{companyId}}`: Company ID
- `{{runId}}`: Run ID
- `{{agent.id}}`: Agent ID (nested)
- `{{agent.name}}`: Agent name
- `{{context.taskId}}`: Task ID from context
- `{{context.wakeReason}}`: Wake reason from context

**Example Template**:
```
You are agent {{agent.id}} ({{agent.name}}) working for company {{companyId}}.
Your current task is {{context.taskId}}.
Wake reason: {{context.wakeReason}}
```

### Timeout and Grace Period Behavior

**Timeout Enforcement**:
1. If `timeoutSec > 0`, start timeout timer when process spawns
2. When timeout expires, send SIGTERM to process
3. Start grace period timer (`graceSec` seconds)
4. If process exits during grace period, return result normally
5. If grace period expires, send SIGKILL to process
6. Return result with `timedOut: true`

**Default Values**:
- `timeoutSec`: 0 (no timeout)
- `graceSec`: 15 seconds

**Rationale**: Grace period allows Kiro to clean up resources (save session state, close files) before forced termination.

### Skills Injection Implementation

**Temporary Directory Strategy**:
```typescript
async function buildSkillsDir(): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'paperclip-skills-'));
  const target = path.join(tmp, '.kiro', 'skills');
  await fs.mkdir(target, { recursive: true });
  
  const skillsDir = await resolvePaperclipSkillsDir();
  if (!skillsDir) return tmp;
  
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await fs.symlink(
        path.join(skillsDir, entry.name),
        path.join(target, entry.name)
      );
    }
  }
  
  return tmp;
}
```

**Cleanup**:
```typescript
try {
  const skillsDir = await buildSkillsDir();
  // ... execute Kiro with --skills-dir flag
} finally {
  await fs.rm(skillsDir, { recursive: true, force: true }).catch(() => {});
}
```

### Error Code Mapping

| Error Condition | Error Code | HTTP Status | Retry Strategy |
|----------------|------------|-------------|----------------|
| Command not found | `command_not_found` | 500 | No retry (config error) |
| Invalid cwd | `invalid_cwd` | 500 | No retry (config error) |
| Relative cwd | `relative_cwd` | 500 | No retry (config error) |
| Timeout | `timeout` | 500 | Retry with longer timeout |
| Unknown session | `unknown_session` | 500 | Auto-retry with fresh session |
| Parse error | `parse_error` | 500 | No retry (output format error) |
| Process error | `process_error` | 500 | Retry (transient error) |
| Auth required | `auth_required` | 401 | No retry (auth error) |

### Compatibility Notes

**Node.js Version**: Requires Node.js 18+ for:
- `fs.mkdtemp` with `os.tmpdir()`
- `fs.symlink` for skills injection
- `AbortController` for timeout handling

**Kiro CLI Version**: Assumes Kiro CLI supports:
- JSON output format (`--output-format json`)
- Session management (`--session-id` flag)
- Skills directory injection (`--skills-dir` flag or equivalent)

If Kiro CLI doesn't support these features, the adapter will need modification.

### Performance Considerations

**Process Spawning**: Each run spawns a new Kiro process:
- Startup overhead: ~1-2 seconds
- Session resume reduces overhead (no re-initialization)
- Consider connection pooling for high-frequency runs

**Output Streaming**: Logs are streamed line-by-line:
- Low memory footprint (no buffering)
- Real-time progress visibility
- Potential performance impact for high-volume output

**Skills Symlinking**: Symlinks are fast:
- No file copying overhead
- Instant directory creation
- Cleanup is fast (remove directory, not individual files)

**Session Persistence**: Session state is small:
- ~100 bytes per session (sessionId + cwd)
- No performance impact on database
- Fast serialization/deserialization

