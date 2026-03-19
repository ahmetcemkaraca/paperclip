import { asNumber, asString, parseJson, parseObject } from "@paperclipai/adapter-utils/server-utils";

function readSessionId(value: unknown): string | null {
  const record = parseObject(value);
  return (
    asString(record.sessionId, "") ||
    asString(record.session_id, "") ||
    asString(parseObject(record.session).id, "") ||
    null
  );
}

function readText(value: unknown): string {
  if (typeof value === "string") return value;
  const record = parseObject(value);
  const parts = Array.isArray(record.parts) ? record.parts : [];
  const joined = parts
    .map((part) => {
      const item = parseObject(part);
      return asString(item.text, "");
    })
    .filter(Boolean)
    .join("");
  return joined || asString(record.text, "") || asString(record.content, "");
}

function readUsage(value: unknown) {
  const usage = parseObject(value);
  return {
    inputTokens:
      asNumber(usage.inputTokens, asNumber(usage.input_tokens, 0)),
    outputTokens:
      asNumber(usage.outputTokens, asNumber(usage.output_tokens, 0)),
    cachedInputTokens:
      asNumber(
        usage.cachedInputTokens,
        asNumber(usage.cached_input_tokens, asNumber(usage.cacheReadInputTokens, 0)),
      ),
  };
}

function inferProviderFromModel(model: string | null): string | null {
  if (!model) return null;
  const normalized = model.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("claude") || normalized.includes("sonnet") || normalized.includes("opus")) {
    return "anthropic";
  }
  if (normalized.startsWith("gpt") || normalized.startsWith("o1") || normalized.startsWith("o3")) {
    return "openai";
  }
  if (normalized.includes("gemini")) return "google";
  return "kiro";
}

export { inferProviderFromModel };

export function parseKiroAcpOutput(stdout: string, stderr = "") {
  let sessionId: string | null = null;
  let model: string | null = null;
  let provider: string | null = null;
  let costUsd: number | null = null;
  let errorMessage: string | null = null;
  const messageParts: string[] = [];
  const usage = {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
  };

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parsed = parseJson(line);
    if (!parsed) continue;

    if ("error" in parsed) {
      const error = parseObject(parsed.error);
      errorMessage =
        asString(error.message, "") ||
        asString(parsed.message, "") ||
        errorMessage;
    }

    const method = asString(parsed.method, "");
    if (method === "session/notification") {
      const params = parseObject(parsed.params);
      const update = parseObject(params.update);
      const updateType =
        asString(update.type, "") ||
        asString(params.type, "");

      if (updateType === "AgentMessageChunk") {
        const text = readText(update);
        if (text) messageParts.push(text);
        continue;
      }

      if (updateType === "TurnEnd") {
        const turnUsage = readUsage(update.usage ?? update.metrics ?? update.turnUsage);
        usage.inputTokens = Math.max(usage.inputTokens, turnUsage.inputTokens);
        usage.outputTokens = Math.max(usage.outputTokens, turnUsage.outputTokens);
        usage.cachedInputTokens = Math.max(usage.cachedInputTokens, turnUsage.cachedInputTokens ?? 0);

        const reportedModel =
          asString(update.model, "") ||
          asString(parseObject(update.turn).model, "");
        if (reportedModel) {
          model = reportedModel;
          provider = inferProviderFromModel(model);
        }

        const nextCost =
          asNumber(update.costUsd, Number.NaN) ||
          asNumber(parseObject(update.cost).usd, Number.NaN);
        if (Number.isFinite(nextCost)) {
          costUsd = nextCost;
        }

        const reportedError =
          asString(update.error, "") ||
          asString(parseObject(update.result).error, "");
        if (reportedError) {
          errorMessage = reportedError;
        }
      }

      continue;
    }

    const result = parseObject(parsed.result);
    const sessionResultId = readSessionId(result);
    if (sessionResultId) {
      sessionId = sessionResultId;
    }

    const resultModel =
      asString(result.model, "") ||
      asString(parseObject(result.session).model, "") ||
      asString(parseObject(result.agentInfo).model, "");
    if (resultModel) {
      model = resultModel;
      provider = inferProviderFromModel(model);
    }

    const resultUsage = readUsage(result.usage);
    usage.inputTokens = Math.max(usage.inputTokens, resultUsage.inputTokens);
    usage.outputTokens = Math.max(usage.outputTokens, resultUsage.outputTokens);
    usage.cachedInputTokens = Math.max(usage.cachedInputTokens, resultUsage.cachedInputTokens ?? 0);

    const resultCost =
      asNumber(result.costUsd, Number.NaN) ||
      asNumber(parseObject(result.cost).usd, Number.NaN);
    if (Number.isFinite(resultCost)) {
      costUsd = resultCost;
    }
  }

  if (!errorMessage) {
    const stderrFirstLine = stderr
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (stderrFirstLine) errorMessage = stderrFirstLine;
  }

  return {
    sessionId,
    summary: messageParts.join("").trim() || null,
    usage,
    model,
    provider,
    costUsd,
    errorMessage,
  };
}

export function isKiroUnknownSessionError(stdout: string, stderr: string): boolean {
  const haystack = `${stdout}\n${stderr}`.toLowerCase();
  return (
    haystack.includes("session/load") &&
    (haystack.includes("not found") ||
      haystack.includes("unknown session") ||
      haystack.includes("no such session"))
  );
}
