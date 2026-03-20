# Implementation Plan: Kiro CLI Adapter

## Overview

This plan implements the Kiro CLI adapter for Paperclip, enabling agents to execute development work using Kiro's autonomous capabilities. The implementation follows Paperclip's three-module adapter architecture (server, UI, CLI) and integrates with existing adapter infrastructure.

## Tasks

- [x] 1. Set up package structure and core exports
  - Create `packages/adapters/kiro-cli/` directory structure
  - Create `package.json` with four export paths: ".", "./server", "./ui", "./cli"
  - Create `tsconfig.json` extending base configuration
  - Create `src/index.ts` with adapter metadata (type, label, models, agentConfigurationDoc)
  - _Requirements: 1.1, 1.2, 1.6_

- [ ] 2. Implement server module core execution logic
  - [x] 2.1 Create server module structure and exports
    - Create `src/server/index.ts` exporting execute, testEnvironment, and sessionCodec
    - Create `src/server/types.ts` with TypeScript interfaces for config and session params
    - _Requirements: 1.3, 5.1_
  
  - [x] 2.2 Implement configuration extraction and validation
    - Create `src/server/config.ts` with configuration extraction logic
    - Implement path validation (absolute path check, existence check)
    - Implement safe extraction helpers (asString, asNumber, asBoolean)
    - _Requirements: 3.1, 5.6, 8.2, 9.5_
  
  - [ ] 2.3 Implement environment variable injection
    - Create `src/server/env.ts` with buildKiroEnv function
    - Inject PAPERCLIP_AGENT_ID, PAPERCLIP_COMPANY_ID, PAPERCLIP_API_URL, PAPERCLIP_RUN_ID, PAPERCLIP_API_KEY
    - Implement redactEnvForLogs for sensitive variable redaction
    - _Requirements: 3.2, 9.1, 9.2, 9.6_
  
  - [~] 2.4 Implement prompt template rendering
    - Create `src/server/template.ts` with renderTemplate function
    - Support variables: agentId, companyId, runId, agent, context
    - Ensure API keys are never included in templates
    - _Requirements: 3.3, 9.1_
  
  - [~] 2.5 Implement core execute function
    - Create `src/server/execute.ts` with main execute function
    - Spawn Kiro process with configuration and environment
    - Stream stdout/stderr via onLog callback
    - Call onMeta with invocation metadata before execution
    - Handle process completion and return AdapterExecutionResult
    - _Requirements: 3.4, 3.5, 3.6_
  
  - [~] 2.6 Write property test for configuration extraction
    - **Property 1: Configuration Extraction**
    - **Validates: Requirements 3.1**
  
  - [~] 2.7 Write property test for environment variable injection
    - **Property 2: Environment Variable Injection**
    - **Validates: Requirements 3.2**
  
  - [~] 2.8 Write property test for template rendering
    - **Property 5: Template Rendering**
    - **Validates: Requirements 3.3**

- [ ] 3. Implement timeout and error handling
  - [~] 3.1 Implement timeout enforcement
    - Add timeout logic with SIGTERM and SIGKILL handling
    - Implement grace period (graceSec) between SIGTERM and SIGKILL
    - Set timedOut flag in result when timeout occurs
    - _Requirements: 3.7, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  
  - [~] 3.2 Implement error handling and error codes
    - Handle non-zero exit codes and populate errorMessage
    - Implement error code mapping (timeout, process_error, signal_*)
    - Differentiate between timeout, process, and parse errors
    - _Requirements: 3.8, 14.2, 14.5, 14.6_
  
  - [~] 3.3 Write property test for timeout enforcement
    - **Property 3: Timeout Enforcement**
    - **Validates: Requirements 3.7, 11.2, 11.6**
  
  - [~] 3.4 Write property test for non-zero exit code handling
    - **Property 4: Non-Zero Exit Code Error Handling**
    - **Validates: Requirements 3.8, 14.2**
  
  - [~] 3.5 Write unit tests for error code mapping
    - Test command_not_found, invalid_cwd, timeout, parse_error
    - _Requirements: 14.1, 14.6_

- [ ] 4. Implement session management
  - [~] 4.1 Implement session codec
    - Create `src/server/session.ts` with sessionCodec implementation
    - Implement deserialize, serialize, and getDisplayId functions
    - Define session parameters structure (sessionId, cwd, workspaceId, repoUrl, repoRef)
    - _Requirements: 4.1, 4.6_
  
  - [~] 4.2 Implement session resumption logic
    - Add session resumption attempt in execute function
    - Validate session cwd matches current config cwd
    - Handle "unknown session" errors with retry and clearSession flag
    - Extract session state from Kiro output and populate sessionParams
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  
  - [~] 4.3 Write property test for session resumption
    - **Property 7: Session Resumption**
    - **Validates: Requirements 4.2, 4.3**
  
  - [~] 4.4 Write property test for session state extraction
    - **Property 8: Session State Extraction**
    - **Validates: Requirements 4.5**

- [ ] 5. Implement output parsing
  - [~] 5.1 Create output parsing utilities
    - Create `src/server/parse.ts` with Kiro output parsing functions
    - Parse JSON lines for session, usage, cost, and summary data
    - Extract inputTokens, outputTokens, cachedInputTokens, costUsd, provider, model
    - Handle parse failures gracefully and include raw output in resultJson
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 14.3_
  
  - [~] 5.2 Write property test for usage and cost extraction
    - **Property 11: Usage and Cost Extraction**
    - **Validates: Requirements 12.1-12.6**
  
  - [~] 5.3 Write property test for parse failure handling
    - **Property 22: Parse Failure Raw Output Inclusion**
    - **Validates: Requirements 14.3**

- [ ] 6. Implement environment testing
  - [~] 6.1 Implement testEnvironment function
    - Create `src/server/test.ts` with testEnvironment implementation
    - Validate command resolvability in PATH
    - Validate cwd exists and is absolute
    - Return appropriate error codes (command_not_found, invalid_cwd, relative_cwd)
    - Return status "pass" or "fail" based on check results
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
  
  - [~] 6.2 Write property test for command resolvability check
    - **Property 17: Command Resolvability Check**
    - **Validates: Requirements 8.1**
  
  - [~] 6.3 Write property test for environment test failure aggregation
    - **Property 18: Environment Test Failure Aggregation**
    - **Validates: Requirements 8.7**
  
  - [~] 6.4 Write unit tests for path validation
    - Test absolute path validation, relative path rejection, non-existent path handling
    - _Requirements: 5.6, 8.2, 8.4, 8.5_

- [~] 7. Checkpoint - Ensure server module tests pass
  - Run `pnpm test:run` for server module
  - Ensure all tests pass, ask the user if questions arise

- [ ] 8. Implement skills injection
  - [~] 8.1 Implement skills directory resolution
    - Create `src/server/skills.ts` with resolvePaperclipSkillsDir function
    - Support both published package and development directory structures
    - _Requirements: 13.1_
  
  - [~] 8.2 Implement temporary skills directory creation
    - Implement buildSkillsDir function with tmpdir creation
    - Symlink Paperclip skills to temporary directory
    - Pass skills directory to Kiro via CLI flag or environment variable
    - _Requirements: 13.2, 13.3, 13.4_
  
  - [~] 8.3 Implement skills cleanup
    - Add finally block to execute function for cleanup
    - Remove temporary directory after run completion
    - _Requirements: 13.5, 13.6_
  
  - [~] 8.4 Write property test for skills injection without cwd pollution
    - **Property 12: Skills Injection Without CWD Pollution**
    - **Validates: Requirements 13.1-13.6**

- [ ] 9. Implement UI module
  - [~] 9.1 Create UI module structure and exports
    - Create `src/ui/index.ts` exporting parseStdoutLine and buildConfig
    - _Requirements: 1.4_
  
  - [~] 9.2 Implement transcript parsing
    - Create `src/ui/parse-stdout.ts` with parseKiroStdoutLine function
    - Parse JSON lines and convert to TranscriptEntry arrays
    - Support entry kinds: init, assistant, tool_call, tool_result, result, stdout
    - Handle unparseable lines with fallback to stdout kind
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  
  - [~] 9.3 Implement config builder
    - Create `src/ui/build-config.ts` with buildKiroConfig function
    - Convert CreateConfigValues to adapter config JSON
    - Provide sensible defaults for timeoutSec and graceSec
    - _Requirements: 5.4, 5.5_
  
  - [~] 9.4 Write property test for transcript parsing
    - **Property 13: Transcript Parsing**
    - **Validates: Requirements 6.1, 6.3-6.6**
  
  - [~] 9.5 Write property test for unparseable line fallback
    - **Property 14: Unparseable Line Fallback**
    - **Validates: Requirements 6.7**
  
  - [~] 9.6 Write property test for configuration defaults
    - **Property 9: Configuration Defaults**
    - **Validates: Requirements 5.5**

- [ ] 10. Implement CLI module
  - [~] 10.1 Create CLI module structure and exports
    - Create `src/cli/index.ts` exporting formatStdoutEvent
    - _Requirements: 1.5_
  
  - [~] 10.2 Implement terminal output formatting
    - Create `src/cli/format-event.ts` with formatKiroStdoutEvent function
    - Parse Kiro stdout lines and print colored terminal output
    - System messages: blue, assistant: green, tool calls: yellow
    - Support debug mode for unrecognized lines (gray)
    - Silently skip unrecognized lines when debug disabled
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [~] 10.3 Write property test for CLI formatting without errors
    - **Property 15: CLI Formatting Without Errors**
    - **Validates: Requirements 7.1**
  
  - [~] 10.4 Write property test for debug mode output suppression
    - **Property 16: Debug Mode Output Suppression**
    - **Validates: Requirements 7.6**

- [~] 11. Checkpoint - Ensure all module tests pass
  - Run `pnpm test:run` for all modules (server, UI, CLI)
  - Ensure all tests pass, ask the user if questions arise

- [ ] 12. Implement security features
  - [~] 12.1 Implement API key security
    - Verify API keys are injected via environment only
    - Verify API keys are never in prompt templates
    - _Requirements: 9.1_
  
  - [~] 12.2 Implement sensitive data redaction
    - Implement redactEnvForLogs with pattern matching
    - Redact API_KEY, TOKEN, SECRET, PASSWORD patterns
    - Apply redaction to onMeta calls
    - _Requirements: 9.2, 9.6_
  
  - [~] 12.3 Implement output sanitization
    - Use safe JSON parsing (no eval)
    - Use type guards for string/number extraction
    - Validate array and object access
    - _Requirements: 9.3, 9.4_
  
  - [~] 12.4 Write property test for API key security
    - **Property 19: API Key Security**
    - **Validates: Requirements 9.1**
  
  - [~] 12.5 Write property test for sensitive environment variable redaction
    - **Property 20: Sensitive Environment Variable Redaction**
    - **Validates: Requirements 9.2**
  
  - [~] 12.6 Write property test for user environment variable pass-through
    - **Property 21: User Environment Variable Pass-Through**
    - **Validates: Requirements 9.6**

- [ ] 13. Register adapter in all three registries
  - [~] 13.1 Register in server registry
    - Add import and registration in `server/src/adapters/registry.ts`
    - _Requirements: 2.1, 2.5_
  
  - [~] 13.2 Register in UI registry
    - Add import and registration in `ui/src/adapters/registry.ts`
    - _Requirements: 2.2, 2.4_
  
  - [~] 13.3 Register in CLI registry
    - Add import and registration in `cli/src/adapters/registry.ts`
    - _Requirements: 2.3_
  
  - [~] 13.4 Write integration test for adapter discovery
    - Test that adapter is discoverable in all three registries
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 14. Implement UI configuration form (optional)
  - [ ] 14.1 Create ConfigFields React component
    - Create `src/ui/ConfigFields.tsx` implementing AdapterConfigFieldsProps
    - Render cwd input field with label "Working Directory"
    - Render model select field with available Kiro models
    - Render promptTemplate textarea field
    - Render command input field with default "kiro"
    - Support both create mode and edit mode
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 15. Write comprehensive documentation
  - [~] 15.1 Document configuration fields in agentConfigurationDoc
    - Document all fields with types and descriptions
    - Include examples of common configuration patterns
    - Document operational fields (timeoutSec, graceSec)
    - Document environment variable injection behavior
    - Document session persistence behavior
    - Write as routing logic for LLM agents, not marketing copy
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [~] 16. Final checkpoint - Integration and verification
  - Run `pnpm -r typecheck` to verify all TypeScript compiles
  - Run `pnpm test:run` to verify all tests pass
  - Run `pnpm build` to verify package builds successfully
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across randomized inputs
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript as specified in the design document
- All security-sensitive operations (API key handling, env var redaction) require careful implementation
