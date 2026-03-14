import { describe, expect, it } from "vitest";
import { parseOpenCodeJsonl, isOpenCodeUnknownSessionError } from "./parse.js";

describe("parseOpenCodeJsonl", () => {
  it("parses assistant text, usage, cost, and errors", () => {
    const stdout = [
      JSON.stringify({
        type: "text",
        sessionID: "session_123",
        part: { text: "Hello from OpenCode" },
      }),
      JSON.stringify({
        type: "step_finish",
        sessionID: "session_123",
        part: {
          reason: "done",
          cost: 0.0025,
          tokens: {
            input: 120,
            output: 40,
            reasoning: 10,
            cache: { read: 20, write: 0 },
          },
        },
      }),
      JSON.stringify({
        type: "error",
        sessionID: "session_123",
        error: { message: "model unavailable" },
      }),
    ].join("\n");

    const parsed = parseOpenCodeJsonl(stdout);
    expect(parsed.sessionId).toBe("session_123");
    expect(parsed.summary).toBe("Hello from OpenCode");
    expect(parsed.usage).toEqual({
      inputTokens: 120,
      cachedInputTokens: 20,
      outputTokens: 50,
    });
    expect(parsed.costUsd).toBeCloseTo(0.0025, 6);
    expect(parsed.errorMessage).toContain("model unavailable");
  });

  it("detects unknown session errors", () => {
    expect(isOpenCodeUnknownSessionError("Session not found: s_123", "")).toBe(true);
    expect(isOpenCodeUnknownSessionError("", "unknown session id")).toBe(true);
    expect(isOpenCodeUnknownSessionError("all good", "")).toBe(false);
  });

  it("does not fail run on recoverable tool_use errors", () => {
    const stdout = [
      JSON.stringify({
        type: "tool_use",
        sessionID: "session_456",
        part: {
          tool: "write",
          state: {
            status: "error",
            error: "You must read file before overwriting it",
          },
        },
      }),
      JSON.stringify({
        type: "text",
        sessionID: "session_456",
        part: { text: "Fixed by reading file first." },
      }),
      JSON.stringify({
        type: "step_finish",
        sessionID: "session_456",
        part: {
          reason: "done",
          cost: 0.001,
          tokens: {
            input: 50,
            output: 20,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
        },
      }),
    ].join("\n");

    const parsed = parseOpenCodeJsonl(stdout);
    expect(parsed.sessionId).toBe("session_456");
    expect(parsed.summary).toBe("Fixed by reading file first.");
    expect(parsed.errorMessage).toBeNull();
  });

  it("captures terminal step_finish failures as errors", () => {
    const stdout = [
      JSON.stringify({
        type: "step_finish",
        sessionID: "session_789",
        part: {
          reason: "failed",
          error: { message: "The user rejected permission to use this specific tool call." },
          cost: 0,
          tokens: {
            input: 10,
            output: 0,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
        },
      }),
    ].join("\n");

    const parsed = parseOpenCodeJsonl(stdout);
    expect(parsed.errorMessage).toContain("rejected permission");
  });
});
