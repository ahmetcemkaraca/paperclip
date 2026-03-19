import type { TranscriptEntry } from "@paperclipai/adapter-utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readText(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (!record) return "";
  return (
    asString(record.text) ||
    asString(record.content) ||
    (Array.isArray(record.parts)
      ? record.parts
          .map((part) => asString(asRecord(part)?.text))
          .join("")
      : "")
  );
}

function readSessionId(value: unknown): string {
  const record = asRecord(value);
  if (!record) return "";
  return (
    asString(record.sessionId) ||
    asString(record.session_id) ||
    asString(asRecord(record.session)?.id)
  );
}

export function parseKiroStdoutLine(line: string, ts: string): TranscriptEntry[] {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return [{ kind: "stdout", ts, text: line }];
  }

  if (!parsed) return [{ kind: "stdout", ts, text: line }];

  if ("error" in parsed) {
    const error = asRecord(parsed.error);
    return [{
      kind: "stderr",
      ts,
      text: asString(error?.message) || asString(parsed.message) || line,
    }];
  }

  const result = asRecord(parsed.result);
  const sessionId = readSessionId(result);
  if (sessionId) {
    return [{
      kind: "init",
      ts,
      model: asString(result?.model) || "kiro",
      sessionId,
    }];
  }

  if (asString(parsed.method) === "session/notification") {
    const params = asRecord(parsed.params) ?? {};
    const update = asRecord(params.update) ?? params;
    const updateType = asString(update.type) || asString(params.type);

    if (updateType === "AgentMessageChunk") {
      const text = readText(update);
      return text ? [{ kind: "assistant", ts, text, delta: true }] : [];
    }

    if (updateType === "ToolCall") {
      return [{
        kind: "tool_call",
        ts,
        name: asString(update.name, "tool"),
        toolUseId: asString(update.toolUseId) || asString(update.id) || undefined,
        input: update.input ?? {},
      }];
    }

    if (updateType === "ToolCallUpdate") {
      const content = readText(update.output) || readText(update.result) || asString(update.status, "tool update");
      return [{
        kind: "tool_result",
        ts,
        toolUseId: asString(update.toolUseId) || asString(update.id) || asString(update.name, "tool"),
        content,
        isError: asString(update.status) === "error" || update.isError === true,
      }];
    }

    if (updateType === "TurnEnd") {
      const usage = asRecord(update.usage) ?? asRecord(update.metrics) ?? {};
      const errors = Array.isArray(update.errors)
        ? update.errors.map((item) => readText(item)).filter(Boolean)
        : [];
      return [{
        kind: "result",
        ts,
        text: readText(update.summary) || asString(update.reason) || "turn complete",
        inputTokens: asNumber(usage.inputTokens, asNumber(usage.input_tokens, 0)),
        outputTokens: asNumber(usage.outputTokens, asNumber(usage.output_tokens, 0)),
        cachedTokens: asNumber(usage.cachedInputTokens, asNumber(usage.cached_input_tokens, 0)),
        costUsd: asNumber(update.costUsd, 0),
        subtype: asString(update.subtype, "turn_end"),
        isError: errors.length > 0 || Boolean(update.error),
        errors,
      }];
    }
  }

  return [{ kind: "stdout", ts, text: line }];
}
