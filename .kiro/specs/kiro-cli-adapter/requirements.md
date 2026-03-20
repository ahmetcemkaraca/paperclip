# Requirements Document: Kiro CLI Adapter

## Introduction

This document defines the requirements for adding a Kiro CLI adapter to the Paperclip project. Kiro is an AI-powered IDE and coding assistant that provides autonomous development capabilities. The Kiro CLI adapter will enable Paperclip agents to execute work using Kiro as their runtime environment, allowing agents to leverage Kiro's code editing, file system operations, and development workflow capabilities.

The adapter will follow Paperclip's established adapter architecture pattern, providing server execution logic, UI transcript parsing, and CLI output formatting. It will support session persistence across runs, enabling agents to maintain context when working on long-running tasks.

## Glossary

- **Kiro**: An AI-powered IDE and coding assistant with CLI capabilities
- **Adapter**: A module that bridges Paperclip's orchestration layer to a specific AI agent runtime
- **Paperclip_Server**: The Express REST API and orchestration service layer
- **Agent_Runtime**: The execution environment where an agent performs work
- **Session_Params**: Opaque session state persisted between agent runs
- **Heartbeat_Run**: A single invocation of an agent by the Paperclip orchestration system
- **Adapter_Config**: JSON configuration blob stored on an agent defining adapter-specific settings
- **CLI_Adapter_Module**: The CLI-facing interface for formatting stdout events
- **Server_Adapter_Module**: The server-facing interface for executing agent runs
- **UI_Adapter_Module**: The UI-facing interface for parsing transcripts and building config forms
- **Transcript_Entry**: A structured log entry displayed in the run detail viewer
- **Control_Plane**: Paperclip's orchestration and management layer
- **Board_Operator**: A human user managing companies and agents through the Paperclip UI
- **Company**: A first-order business entity in Paperclip; all agents and work are company-scoped

## Requirements

### Requirement 1: Kiro CLI Adapter Package Structure

**User Story:** As a Paperclip developer, I want the Kiro adapter to follow the established package structure, so that it integrates consistently with the existing adapter system.

#### Acceptance Criteria

1. THE Kiro_Adapter_Package SHALL be created at `packages/adapters/kiro-cli/`
2. THE Kiro_Adapter_Package SHALL export adapter metadata from `src/index.ts` including type, label, models, and agentConfigurationDoc
3. THE Kiro_Adapter_Package SHALL provide server exports from `src/server/index.ts` including execute, testEnvironment, and sessionCodec
4. THE Kiro_Adapter_Package SHALL provide UI exports from `src/ui/index.ts` including parseStdoutLine and buildConfig
5. THE Kiro_Adapter_Package SHALL provide CLI exports from `src/cli/index.ts` including formatStdoutEvent
6. THE Kiro_Adapter_Package SHALL declare four export paths in package.json: ".", "./server", "./ui", and "./cli"

### Requirement 2: Kiro Adapter Registration

**User Story:** As a Paperclip system, I want the Kiro adapter to be registered in all three consumer registries, so that the server, UI, and CLI can discover and use it.

#### Acceptance Criteria

1. THE Paperclip_Server SHALL register the Kiro adapter in `server/src/adapters/registry.ts`
2. THE Paperclip_UI SHALL register the Kiro adapter in `ui/src/adapters/registry.ts`
3. THE Paperclip_CLI SHALL register the Kiro adapter in `cli/src/adapters/registry.ts`
4. WHEN a Board_Operator creates an agent, THE Paperclip_UI SHALL display "Kiro CLI" as an available adapter type
5. WHEN an agent with adapter type "kiro_cli" is invoked, THE Paperclip_Server SHALL route execution to the Kiro adapter's execute function

### Requirement 3: Kiro CLI Execution

**User Story:** As a Paperclip agent, I want to execute work using the Kiro CLI, so that I can leverage Kiro's development capabilities to complete tasks.

#### Acceptance Criteria

1. WHEN the Kiro adapter receives an AdapterExecutionContext, THE Kiro_Adapter SHALL extract configuration values including cwd, command, model, and promptTemplate
2. WHEN the Kiro adapter spawns a Kiro process, THE Kiro_Adapter SHALL inject PAPERCLIP_* environment variables including PAPERCLIP_AGENT_ID, PAPERCLIP_COMPANY_ID, PAPERCLIP_API_URL, PAPERCLIP_RUN_ID, and PAPERCLIP_API_KEY
3. WHEN the Kiro adapter renders a prompt, THE Kiro_Adapter SHALL use renderTemplate with variables including agentId, companyId, runId, agent, and context
4. WHEN the Kiro adapter spawns a process, THE Kiro_Adapter SHALL call onLog for all stdout and stderr output
5. WHEN the Kiro adapter spawns a process, THE Kiro_Adapter SHALL call onMeta with invocation metadata before process execution
6. WHEN the Kiro process completes, THE Kiro_Adapter SHALL return an AdapterExecutionResult with exitCode, usage, sessionParams, and summary
7. WHEN the Kiro process times out, THE Kiro_Adapter SHALL set timedOut to true in the result
8. IF the Kiro process exits with a non-zero code, THEN THE Kiro_Adapter SHALL populate errorMessage in the result

### Requirement 4: Kiro Session Management

**User Story:** As a Paperclip agent, I want my Kiro sessions to persist across runs, so that I maintain conversation context when working on long-running tasks.

#### Acceptance Criteria

1. THE Kiro_Adapter SHALL implement a sessionCodec with deserialize, serialize, and getDisplayId functions
2. WHEN a Heartbeat_Run includes existing Session_Params, THE Kiro_Adapter SHALL attempt to resume the Kiro session
3. WHEN the stored session cwd differs from the current config cwd, THE Kiro_Adapter SHALL start a fresh session instead of resuming
4. WHEN Kiro returns an "unknown session" error, THE Kiro_Adapter SHALL retry with a fresh session and return clearSession true
5. WHEN a Kiro run completes successfully, THE Kiro_Adapter SHALL extract session state from output and populate sessionParams in the result
6. THE Kiro_Adapter sessionCodec getDisplayId function SHALL return a human-readable session identifier for UI display

### Requirement 5: Kiro Configuration Schema

**User Story:** As a Board_Operator, I want to configure Kiro agents with appropriate settings, so that agents execute with the correct working directory, model, and runtime parameters.

#### Acceptance Criteria

1. THE Kiro_Adapter agentConfigurationDoc SHALL document all supported configuration fields including cwd, command, model, promptTemplate, timeoutSec, and graceSec
2. THE Kiro_Adapter agentConfigurationDoc SHALL include "use when" guidance describing when Kiro is appropriate
3. THE Kiro_Adapter agentConfigurationDoc SHALL include "don't use when" guidance describing when other adapters are more appropriate
4. THE Kiro_Adapter buildConfig function SHALL convert CreateConfigValues to a valid Adapter_Config JSON blob
5. THE Kiro_Adapter buildConfig function SHALL provide sensible defaults for optional fields including timeoutSec and graceSec
6. THE Kiro_Adapter execute function SHALL validate that cwd is an absolute path and exists

### Requirement 6: Kiro Output Parsing

**User Story:** As a Board_Operator, I want to view structured transcripts of Kiro agent runs, so that I can understand what the agent did and diagnose issues.

#### Acceptance Criteria

1. THE Kiro_Adapter parseStdoutLine function SHALL convert Kiro stdout lines to TranscriptEntry arrays
2. WHEN Kiro outputs a session initialization event, THE Kiro_Adapter SHALL produce a TranscriptEntry with kind "init"
3. WHEN Kiro outputs an assistant response, THE Kiro_Adapter SHALL produce a TranscriptEntry with kind "assistant"
4. WHEN Kiro outputs a tool call, THE Kiro_Adapter SHALL produce a TranscriptEntry with kind "tool_call" including name and input
5. WHEN Kiro outputs a tool result, THE Kiro_Adapter SHALL produce a TranscriptEntry with kind "tool_result" including content and isError flag
6. WHEN Kiro outputs a final result with usage stats, THE Kiro_Adapter SHALL produce a TranscriptEntry with kind "result" including inputTokens, outputTokens, and costUsd
7. WHEN Kiro outputs an unparseable line, THE Kiro_Adapter SHALL produce a TranscriptEntry with kind "stdout" containing the raw text

### Requirement 7: Kiro CLI Output Formatting

**User Story:** As a developer running `paperclipai run --watch`, I want to see colored, readable output from Kiro agents, so that I can monitor agent progress in real time.

#### Acceptance Criteria

1. THE Kiro_CLI_Adapter formatStdoutEvent function SHALL parse Kiro stdout lines and print colored terminal output
2. WHEN Kiro outputs a system message, THE Kiro_CLI_Adapter SHALL print it in blue
3. WHEN Kiro outputs an assistant message, THE Kiro_CLI_Adapter SHALL print it in green
4. WHEN Kiro outputs a tool call, THE Kiro_CLI_Adapter SHALL print it in yellow
5. WHEN debug mode is enabled, THE Kiro_CLI_Adapter SHALL print unrecognized lines in gray
6. WHEN debug mode is disabled, THE Kiro_CLI_Adapter SHALL silently skip unrecognized lines

### Requirement 8: Kiro Environment Testing

**User Story:** As a Board_Operator, I want to test the Kiro environment before running an agent, so that I can identify configuration issues early.

#### Acceptance Criteria

1. THE Kiro_Adapter testEnvironment function SHALL validate that the Kiro command is resolvable in PATH
2. THE Kiro_Adapter testEnvironment function SHALL validate that the configured cwd exists and is absolute
3. IF the Kiro command is not found, THEN THE Kiro_Adapter SHALL return an AdapterEnvironmentCheck with level "error" and code "command_not_found"
4. IF the cwd does not exist, THEN THE Kiro_Adapter SHALL return an AdapterEnvironmentCheck with level "error" and code "invalid_cwd"
5. IF the cwd is relative, THEN THE Kiro_Adapter SHALL return an AdapterEnvironmentCheck with level "error" and code "relative_cwd"
6. IF all checks pass, THEN THE Kiro_Adapter SHALL return status "pass"
7. IF any check has level "error", THEN THE Kiro_Adapter SHALL return status "fail"

### Requirement 9: Kiro Adapter Security

**User Story:** As a Paperclip system, I want the Kiro adapter to handle secrets securely, so that API keys and tokens are not exposed in logs or prompts.

#### Acceptance Criteria

1. THE Kiro_Adapter SHALL inject PAPERCLIP_API_KEY via environment variables, not prompt templates
2. WHEN the Kiro adapter calls onMeta, THE Kiro_Adapter SHALL redact sensitive environment variables using redactEnvForLogs
3. THE Kiro_Adapter SHALL treat all Kiro output as untrusted and parse it defensively
4. THE Kiro_Adapter SHALL NOT execute or eval any content from Kiro output
5. THE Kiro_Adapter SHALL use safe extraction helpers (asString, asNumber, asBoolean) when reading config values
6. WHEN user-provided env vars are configured, THE Kiro_Adapter SHALL pass them to the Kiro process without logging their values

### Requirement 10: Kiro UI Configuration Form

**User Story:** As a Board_Operator, I want to configure Kiro agents through a form in the UI, so that I can set working directory, model, and other parameters without editing JSON.

#### Acceptance Criteria

1. THE Kiro_UI_Adapter SHALL provide a ConfigFields React component implementing AdapterConfigFieldsProps
2. THE Kiro_ConfigFields component SHALL render a cwd input field with label "Working Directory"
3. THE Kiro_ConfigFields component SHALL render a model select field with available Kiro models
4. THE Kiro_ConfigFields component SHALL render a promptTemplate textarea field with label "Prompt Template"
5. THE Kiro_ConfigFields component SHALL render a command input field with default value "kiro"
6. THE Kiro_ConfigFields component SHALL support both create mode (using values/set) and edit mode (using config/eff/mark)
7. THE Kiro_ConfigFields component SHALL use shared primitives from ui/src/components/agent-config-primitives

### Requirement 11: Kiro Adapter Timeout and Cancellation

**User Story:** As a Paperclip system, I want to enforce timeouts on Kiro runs, so that runaway processes do not consume unbounded resources.

#### Acceptance Criteria

1. THE Kiro_Adapter SHALL read timeoutSec from Adapter_Config with a default value
2. WHEN timeoutSec is greater than zero, THE Kiro_Adapter SHALL enforce a timeout on the Kiro process
3. WHEN the timeout is reached, THE Kiro_Adapter SHALL send SIGTERM to the Kiro process
4. THE Kiro_Adapter SHALL read graceSec from Adapter_Config with a default value of 15
5. WHEN graceSec elapses after SIGTERM, THE Kiro_Adapter SHALL send SIGKILL to the Kiro process
6. WHEN a timeout occurs, THE Kiro_Adapter SHALL set timedOut to true in the result

### Requirement 12: Kiro Adapter Cost Tracking

**User Story:** As a Board_Operator, I want to track token usage and costs for Kiro agent runs, so that I can monitor budget consumption.

#### Acceptance Criteria

1. WHEN Kiro outputs usage statistics, THE Kiro_Adapter SHALL extract inputTokens and outputTokens
2. WHEN Kiro outputs cost information, THE Kiro_Adapter SHALL extract costUsd
3. THE Kiro_Adapter SHALL populate the usage field in AdapterExecutionResult with inputTokens, outputTokens, and cachedInputTokens
4. THE Kiro_Adapter SHALL populate the costUsd field in AdapterExecutionResult when cost data is available
5. THE Kiro_Adapter SHALL populate the provider field in AdapterExecutionResult with the provider name
6. THE Kiro_Adapter SHALL populate the model field in AdapterExecutionResult with the model identifier

### Requirement 13: Kiro Paperclip Skills Injection

**User Story:** As a Paperclip agent using Kiro, I want access to Paperclip skills, so that I can use the paperclip API skill and other shared workflows.

#### Acceptance Criteria

1. THE Kiro_Adapter SHALL make Paperclip skills discoverable to Kiro without polluting the agent's cwd
2. IF Kiro supports an "additional directory" flag, THEN THE Kiro_Adapter SHALL create a tmpdir, symlink skills, pass the flag, and clean up after the run
3. IF Kiro supports a global skills directory, THEN THE Kiro_Adapter SHALL symlink Paperclip skills there without overwriting existing user skills
4. IF Kiro supports a skills path environment variable, THEN THE Kiro_Adapter SHALL set it to point at the repo's skills directory
5. THE Kiro_Adapter SHALL NOT copy or symlink skills into the agent's cwd
6. THE Kiro_Adapter SHALL clean up any temporary directories in a finally block after run completion

### Requirement 14: Kiro Adapter Error Handling

**User Story:** As a Board_Operator, I want clear error messages when Kiro runs fail, so that I can diagnose and fix issues quickly.

#### Acceptance Criteria

1. WHEN the Kiro command is not found, THE Kiro_Adapter SHALL return an errorMessage indicating the command is missing
2. WHEN the Kiro process exits with a non-zero code, THE Kiro_Adapter SHALL populate errorMessage with a description of the failure
3. WHEN Kiro output parsing fails, THE Kiro_Adapter SHALL include raw stdout and stderr in resultJson
4. WHEN a session resume fails, THE Kiro_Adapter SHALL include the session error in errorMessage
5. THE Kiro_Adapter SHALL differentiate between timeout errors, process errors, and parse failures in errorMessage
6. THE Kiro_Adapter SHALL populate errorCode with a machine-readable error identifier when applicable

### Requirement 15: Kiro Adapter Documentation

**User Story:** As a Paperclip developer, I want comprehensive documentation for the Kiro adapter, so that I can understand how to use and maintain it.

#### Acceptance Criteria

1. THE Kiro_Adapter agentConfigurationDoc SHALL document all configuration fields with types and descriptions
2. THE Kiro_Adapter agentConfigurationDoc SHALL include examples of common configuration patterns
3. THE Kiro_Adapter agentConfigurationDoc SHALL document operational fields including timeoutSec and graceSec
4. THE Kiro_Adapter agentConfigurationDoc SHALL document environment variable injection behavior
5. THE Kiro_Adapter agentConfigurationDoc SHALL document session persistence behavior
6. THE Kiro_Adapter agentConfigurationDoc SHALL be written as routing logic for LLM agents, not marketing copy
