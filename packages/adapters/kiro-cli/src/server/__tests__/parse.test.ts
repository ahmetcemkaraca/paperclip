import { describe, expect, test } from "vitest";
import { isKiroUnknownSessionError, parseKiroAcpOutput } from "../parse.js";

describe("parseKiroAcpOutput", () => {
  test("extracts session, summary, usage, model, and cost from ACP lines", () => {
    const stdout = [
      JSON.stringify({ jsonrpc: "2.0", id: 1, result: { sessionId: "sess_123" } }),
      JSON.stringify({
        jsonrpc: "2.0",
        method: "session/notification",
        params: { update: { type: "AgentMessageChunk", text: "Hello" } },
      }),
      JSON.stringify({
        jsonrpc: "2.0",
        method: "session/notification",
        params: {
          update: {
            type: "TurnEnd",
            model: "claude-sonnet-4",
            costUsd: 0.12,
            usage: { inputTokens: 100, outputTokens: 40, cachedInputTokens: 5 },
          },
        },
      }),
    ].join("\n");

    const parsed = parseKiroAcpOutput(stdout);
    expect(parsed.sessionId).toBe("sess_123");
    expect(parsed.summary).toBe("Hello");
    expect(parsed.model).toBe("claude-sonnet-4");
    expect(parsed.provider).toBe("anthropic");
    expect(parsed.costUsd).toBe(0.12);
    expect(parsed.usage).toEqual({
      inputTokens: 100,
      outputTokens: 40,
      cachedInputTokens: 5,
    });
  });
});

describe("isKiroUnknownSessionError", () => {
  test("detects missing session failures", () => {
    expect(
      isKiroUnknownSessionError(
        '{"method":"session/load"}',
        "Session not found",
      ),
    ).toBe(true);
  });
});
