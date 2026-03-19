// Unit tests for configuration extraction and validation

import { describe, test, expect } from "vitest";
import { extractConfig, buildRuntimeConfig, validatePathExists } from "../config.js";

describe("extractConfig", () => {
  test("extracts valid minimal configuration", () => {
    const config = extractConfig({ cwd: "/absolute/path" });
    
    expect(config.cwd).toBe("/absolute/path");
    expect(config.command).toBe("kiro-cli");
  });

  test("extracts all optional fields when provided", () => {
    const config = extractConfig({
      cwd: "/absolute/path",
      command: "custom-kiro",
      model: "claude-opus-4",
      promptTemplate: "Hello {{agentId}}",
      maxTurnsPerRun: 10,
      env: { FOO: "bar", BAZ: "qux" },
      extraArgs: ["--verbose", "--debug"],
      timeoutSec: 300,
      graceSec: 30,
    });

    expect(config.cwd).toBe("/absolute/path");
    expect(config.command).toBe("custom-kiro");
    expect(config.model).toBe("claude-opus-4");
    expect(config.promptTemplate).toBe("Hello {{agentId}}");
    expect(config.maxTurnsPerRun).toBe(10);
    expect(config.env).toEqual({ FOO: "bar", BAZ: "qux" });
    expect(config.extraArgs).toEqual(["--verbose", "--debug"]);
    expect(config.timeoutSec).toBe(300);
    expect(config.graceSec).toBe(30);
  });

  test("throws error when cwd is missing", () => {
    expect(() => extractConfig({})).toThrow('Configuration error: "cwd" is required');
  });

  test("throws error when cwd is empty string", () => {
    expect(() => extractConfig({ cwd: "" })).toThrow('Configuration error: "cwd" is required');
  });

  test("throws error when cwd is not absolute path", () => {
    expect(() => extractConfig({ cwd: "relative/path" })).toThrow(
      'Configuration error: "cwd" must be an absolute path'
    );
  });

  test("throws error when cwd is relative with dot notation", () => {
    expect(() => extractConfig({ cwd: "./relative/path" })).toThrow(
      'Configuration error: "cwd" must be an absolute path'
    );
  });

  test("handles null config gracefully", () => {
    expect(() => extractConfig(null)).toThrow('Configuration error: "cwd" is required');
  });

  test("handles undefined config gracefully", () => {
    expect(() => extractConfig(undefined)).toThrow('Configuration error: "cwd" is required');
  });

  test("filters out non-string values from env", () => {
    const config = extractConfig({
      cwd: "/absolute/path",
      env: {
        VALID: "value",
        INVALID_NUMBER: 123,
        INVALID_BOOL: true,
        INVALID_NULL: null,
        INVALID_UNDEFINED: undefined,
      },
    });

    expect(config.env).toEqual({
      VALID: "value",
      INVALID_NUMBER: "",
      INVALID_BOOL: "",
      INVALID_NULL: "",
      INVALID_UNDEFINED: "",
    });
  });

  test("filters out non-string values from extraArgs", () => {
    const config = extractConfig({
      cwd: "/absolute/path",
      extraArgs: ["valid", 123, true, null, undefined, "also-valid"],
    });

    expect(config.extraArgs).toEqual(["valid", "also-valid"]);
  });

  test("uses default values for invalid types", () => {
    const config = extractConfig({
      cwd: "/absolute/path",
      command: 123, // Invalid type
      model: true, // Invalid type
      timeoutSec: "not-a-number", // Invalid type
      graceSec: null, // Invalid type
    });

    expect(config.command).toBe("kiro-cli"); // Default
    expect(config.model).toBe(""); // Empty string fallback
    expect(config.timeoutSec).toBe(0); // Default fallback
    expect(config.graceSec).toBe(15); // Default fallback
  });

  test("handles Windows absolute paths", () => {
    const config = extractConfig({ cwd: "C:\\Users\\test\\project" });
    expect(config.cwd).toBe("C:\\Users\\test\\project");
  });

  test("handles Unix absolute paths", () => {
    const config = extractConfig({ cwd: "/home/user/project" });
    expect(config.cwd).toBe("/home/user/project");
  });
});

describe("buildRuntimeConfig", () => {
  test("builds runtime config with defaults", () => {
    const adapterConfig = {
      cwd: "/absolute/path",
      command: "kiro-cli",
    };

    const runtimeConfig = buildRuntimeConfig(adapterConfig);

    expect(runtimeConfig.command).toBe("kiro-cli");
    expect(runtimeConfig.cwd).toBe("/absolute/path");
    expect(runtimeConfig.workspaceId).toBeNull();
    expect(runtimeConfig.workspaceRepoUrl).toBeNull();
    expect(runtimeConfig.workspaceRepoRef).toBeNull();
    expect(runtimeConfig.env).toEqual({});
    expect(runtimeConfig.timeoutSec).toBe(0);
    expect(runtimeConfig.graceSec).toBe(15);
    expect(runtimeConfig.extraArgs).toEqual([]);
  });

  test("merges adapter config with context", () => {
    const adapterConfig = {
      cwd: "/absolute/path",
      command: "custom-kiro",
      env: { ADAPTER_VAR: "adapter-value" },
      timeoutSec: 300,
      graceSec: 30,
      extraArgs: ["--verbose"],
    };

    const context = {
      workspaceId: "workspace-123",
      workspaceRepoUrl: "https://github.com/user/repo",
      workspaceRepoRef: "main",
      env: { CONTEXT_VAR: "context-value" },
    };

    const runtimeConfig = buildRuntimeConfig(adapterConfig, context);

    expect(runtimeConfig.command).toBe("custom-kiro");
    expect(runtimeConfig.cwd).toBe("/absolute/path");
    expect(runtimeConfig.workspaceId).toBe("workspace-123");
    expect(runtimeConfig.workspaceRepoUrl).toBe("https://github.com/user/repo");
    expect(runtimeConfig.workspaceRepoRef).toBe("main");
    expect(runtimeConfig.env).toEqual({
      ADAPTER_VAR: "adapter-value",
      CONTEXT_VAR: "context-value",
    });
    expect(runtimeConfig.timeoutSec).toBe(300);
    expect(runtimeConfig.graceSec).toBe(30);
    expect(runtimeConfig.extraArgs).toEqual(["--verbose"]);
  });

  test("context env overrides adapter env for same keys", () => {
    const adapterConfig = {
      cwd: "/absolute/path",
      env: { SHARED_VAR: "adapter-value", ADAPTER_ONLY: "adapter" },
    };

    const context = {
      env: { SHARED_VAR: "context-value", CONTEXT_ONLY: "context" },
    };

    const runtimeConfig = buildRuntimeConfig(adapterConfig, context);

    expect(runtimeConfig.env).toEqual({
      ADAPTER_ONLY: "adapter",
      SHARED_VAR: "context-value", // Context wins
      CONTEXT_ONLY: "context",
    });
  });

  test("handles empty context", () => {
    const adapterConfig = {
      cwd: "/absolute/path",
      command: "kiro-cli",
    };

    const runtimeConfig = buildRuntimeConfig(adapterConfig, {});

    expect(runtimeConfig.workspaceId).toBeNull();
    expect(runtimeConfig.workspaceRepoUrl).toBeNull();
    expect(runtimeConfig.workspaceRepoRef).toBeNull();
    expect(runtimeConfig.env).toEqual({});
  });

  test("handles null workspace values in context", () => {
    const adapterConfig = {
      cwd: "/absolute/path",
    };

    const context = {
      workspaceId: null,
      workspaceRepoUrl: null,
      workspaceRepoRef: null,
    };

    const runtimeConfig = buildRuntimeConfig(adapterConfig, context);

    expect(runtimeConfig.workspaceId).toBeNull();
    expect(runtimeConfig.workspaceRepoUrl).toBeNull();
    expect(runtimeConfig.workspaceRepoRef).toBeNull();
  });
});

describe("validatePathExists", () => {
  test("returns null for absolute Unix path", () => {
    expect(validatePathExists("/absolute/path")).toBeNull();
  });

  test("returns null for absolute Windows path", () => {
    expect(validatePathExists("C:\\absolute\\path")).toBeNull();
  });

  test("returns error for relative path", () => {
    const error = validatePathExists("relative/path");
    expect(error).toContain("Path must be absolute");
    expect(error).toContain("relative/path");
  });

  test("returns error for relative path with dot notation", () => {
    const error = validatePathExists("./relative/path");
    expect(error).toContain("Path must be absolute");
  });

  test("returns error for relative path with parent notation", () => {
    const error = validatePathExists("../relative/path");
    expect(error).toContain("Path must be absolute");
  });
});
