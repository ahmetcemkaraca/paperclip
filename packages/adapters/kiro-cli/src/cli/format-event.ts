import pc from "picocolors";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
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

export function printKiroStreamEvent(line: string, debug: boolean): void {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    if (debug) console.log(pc.gray(line));
    return;
  }

  if (!parsed) return;

  if ("error" in parsed) {
    const error = asRecord(parsed.error);
    console.log(pc.red(asString(error?.message) || asString(parsed.message) || "Kiro error"));
    return;
  }

  const result = asRecord(parsed.result);
  const sessionId =
    asString(result?.sessionId) ||
    asString(result?.session_id) ||
    asString(asRecord(result?.session)?.id);
  if (sessionId) {
    console.log(pc.blue(`session ${sessionId}`));
    return;
  }

  if (asString(parsed.method) !== "session/notification") {
    if (debug) console.log(pc.gray(line));
    return;
  }

  const params = asRecord(parsed.params) ?? {};
  const update = asRecord(params.update) ?? params;
  const updateType = asString(update.type) || asString(params.type);

  if (updateType === "AgentMessageChunk") {
    const text = readText(update);
    if (text) console.log(pc.green(text));
    return;
  }

  if (updateType === "ToolCall") {
    console.log(pc.yellow(`tool ${asString(update.name, "tool")}`));
    return;
  }

  if (updateType === "ToolCallUpdate") {
    const status = asString(update.status, "update");
    const content = readText(update.output) || readText(update.result);
    const rendered = content ? `${status}: ${content}` : status;
    console.log((status === "error" ? pc.red : pc.yellow)(rendered));
    return;
  }

  if (updateType === "TurnEnd") {
    const usage = asRecord(update.usage) ?? asRecord(update.metrics) ?? {};
    const inputTokens = Number(usage.inputTokens ?? usage.input_tokens ?? 0);
    const outputTokens = Number(usage.outputTokens ?? usage.output_tokens ?? 0);
    const costUsd = typeof update.costUsd === "number" ? update.costUsd : 0;
    console.log(pc.blue(`turn complete in=${inputTokens} out=${outputTokens} cost=$${costUsd.toFixed(4)}`));
    return;
  }

  if (debug) console.log(pc.gray(line));
}
