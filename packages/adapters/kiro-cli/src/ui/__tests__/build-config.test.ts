import { describe, expect, test } from "vitest";
import { buildKiroConfig } from "../build-config.js";

describe("buildKiroConfig", () => {
  test("builds adapter config with defaults and parsed args", () => {
    const config = buildKiroConfig({
      adapterType: "kiro_cli",
      cwd: "/repo",
      instructionsFilePath: "/repo/AGENTS.md",
      promptTemplate: "Continue",
      model: "claude-sonnet-4",
      thinkingEffort: "",
      chrome: false,
      dangerouslySkipPermissions: false,
      search: false,
      dangerouslyBypassSandbox: false,
      command: "kiro-cli",
      args: "",
      extraArgs: "--agent, backend",
      envVars: "FOO=bar",
      envBindings: {},
      url: "",
      bootstrapPrompt: "Bootstrap",
      maxTurnsPerRun: 3,
      heartbeatEnabled: false,
      intervalSec: 300,
    });

    expect(config).toMatchObject({
      cwd: "/repo",
      instructionsFilePath: "/repo/AGENTS.md",
      promptTemplate: "Continue",
      bootstrapPromptTemplate: "Bootstrap",
      model: "claude-sonnet-4",
      command: "kiro-cli",
      extraArgs: ["--agent", "backend"],
      maxTurnsPerRun: 3,
      timeoutSec: 0,
      graceSec: 15,
    });
  });
});
