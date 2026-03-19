import fs from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { inferOpenAiCompatibleBiller, type AdapterExecutionContext, type AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asString,
  buildPaperclipEnv,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  joinPromptSections,
  redactEnvForLogs,
  renderTemplate,
} from "@paperclipai/adapter-utils/server-utils";
import { extractConfig } from "./config.js";
import { ensureKiroSkillsInjected } from "./skills.js";
import { inferProviderFromModel, isKiroUnknownSessionError, parseKiroAcpOutput } from "./parse.js";

type JsonRpcId = number;

type JsonRpcPending = {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
};

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const value = env[key];
  return typeof value === "string" && value.trim().length > 0;
}

function resolveKiroBillingType(env: Record<string, string>): "api" | "subscription" {
  return hasNonEmptyEnvValue(env, "KIRO_API_KEY") ||
    hasNonEmptyEnvValue(env, "OPENAI_API_KEY") ||
    hasNonEmptyEnvValue(env, "ANTHROPIC_API_KEY")
    ? "api"
    : "subscription";
}

function resolveKiroBiller(
  env: Record<string, string>,
  billingType: "api" | "subscription",
  provider: string | null,
): string {
  const openAiCompatibleBiller = inferOpenAiCompatibleBiller(env, provider ?? "openai");
  if (openAiCompatibleBiller === "openrouter") return "openrouter";
  if (billingType === "subscription") return "kiro";
  return openAiCompatibleBiller ?? provider ?? "kiro";
}

function readTextValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  const direct = asString(record.text, "") || asString(record.content, "");
  if (direct) return direct;
  const parts = Array.isArray(record.parts) ? record.parts : [];
  return parts
    .map((part) => {
      if (typeof part !== "object" || part === null || Array.isArray(part)) return "";
      return asString((part as Record<string, unknown>).text, "");
    })
    .join("");
}

function readSessionId(result: unknown): string | null {
  if (typeof result !== "object" || result === null || Array.isArray(result)) return null;
  const record = result as Record<string, unknown>;
  const nested = typeof record.session === "object" && record.session !== null
    ? record.session as Record<string, unknown>
    : null;
  return (
    asString(record.sessionId, "") ||
    asString(record.session_id, "") ||
    asString(nested?.id, "") ||
    null
  );
}

function normalizeJsonRpcError(error: unknown): Error {
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    return new Error("Kiro ACP request failed");
  }
  const record = error as Record<string, unknown>;
  const message = asString(record.message, "Kiro ACP request failed");
  const code = typeof record.code === "number" ? ` (${record.code})` : "";
  return new Error(`${message}${code}`);
}

type PromptOutcome = {
  errors: string[];
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
  costUsd: number | null;
  model: string | null;
  provider: string | null;
};

type KiroAcpRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  promptOutcome: PromptOutcome | null;
  sessionId: string | null;
};

type NotificationHandler = (message: Record<string, unknown>) => void;

async function runKiroAcp(
  ctx: AdapterExecutionContext,
  options: {
    command: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
    prompt: string;
    timeoutSec: number;
    graceSec: number;
    model: string | undefined;
    resumeSessionId: string | null;
    maxTurnsPerRun: number | undefined;
  },
): Promise<KiroAcpRunResult> {
  const { onLog } = ctx;
  const mergedEnv = ensurePathInEnv({ ...process.env, ...options.env });
  const child = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: mergedEnv,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let stdoutBuffer = "";
  let exitCode: number | null = null;
  let signal: string | null = null;
  let timedOut = false;
  let promptOutcome: PromptOutcome | null = null;
  let sessionId: string | null = options.resumeSessionId;
  let requestId: JsonRpcId = 1;
  const pending = new Map<JsonRpcId, JsonRpcPending>();
  const notificationHandlers = new Set<NotificationHandler>();

  const closePromise = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, sig) => {
      exitCode = code;
      signal = sig;
      resolve();
    });
  });

  const flushLine = async (line: string) => {
    if (!line.trim()) return;
    stdout += `${line}\n`;
    await onLog("stdout", `${line}\n`);

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }

    const id = typeof parsed.id === "number" ? parsed.id : null;
    if (id !== null && pending.has(id)) {
      const waiter = pending.get(id)!;
      pending.delete(id);
      if ("error" in parsed) {
        waiter.reject(normalizeJsonRpcError(parsed.error));
      } else {
        waiter.resolve(parsed);
      }
      return;
    }

    if (asString(parsed.method, "") === "session/notification") {
      for (const handler of notificationHandlers) handler(parsed);
    }
  };

  child.stdout?.on("data", (chunk: unknown) => {
    const text = String(chunk);
    stdoutBuffer += text;
    void (async () => {
      const parts = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = parts.pop() ?? "";
      for (const part of parts) {
        await flushLine(part);
      }
    })();
  });

  child.stderr?.on("data", (chunk: unknown) => {
    const text = String(chunk);
    stderr += text;
    void onLog("stderr", text);
  });

  const timeoutHandle = options.timeoutSec > 0
    ? setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
        }, Math.max(1, options.graceSec) * 1000);
      }, options.timeoutSec * 1000)
    : null;

  const request = async (method: string, params: Record<string, unknown>) => {
    const id = requestId++;
    const responsePromise = new Promise<Record<string, unknown>>((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    child.stdin?.write(`${payload}\n`);
    return responsePromise;
  };

  try {
    await request("initialize", {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: {
        name: "paperclip",
        version: "0.3.1",
      },
    });

    const loadOrNew = async (resumeId: string | null) => {
      if (resumeId) {
        const response = await request("session/load", { sessionId: resumeId });
        sessionId = readSessionId(response.result) ?? resumeId;
        return;
      }
      const response = await request("session/new", { cwd: options.cwd, mcpServers: [] });
      sessionId = readSessionId(response.result);
      if (!sessionId) {
        throw new Error("Kiro ACP did not return a session id");
      }
    };

    await loadOrNew(options.resumeSessionId);

    if (options.model && sessionId) {
      await request("session/set_model", {
        sessionId,
        model: options.model,
      }).catch(() => undefined);
    }

    const turnDonePromise = new Promise<PromptOutcome>((resolve) => {
      const usage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
      const errors: string[] = [];
      let costUsd: number | null = null;
      let model: string | null = options.model ?? null;
      let provider: string | null = inferProviderFromModel(model);

      const handler: NotificationHandler = (message) => {
        const params = typeof message.params === "object" && message.params !== null
          ? message.params as Record<string, unknown>
          : {};
        const update = typeof params.update === "object" && params.update !== null
          ? params.update as Record<string, unknown>
          : params;
        const updateType = asString(update.type, "") || asString(params.type, "");

        if (updateType === "TurnEnd") {
          const metrics = typeof update.usage === "object" && update.usage !== null
            ? update.usage as Record<string, unknown>
            : (typeof update.metrics === "object" && update.metrics !== null ? update.metrics as Record<string, unknown> : {});
          usage.inputTokens = Number(metrics.inputTokens ?? metrics.input_tokens ?? usage.inputTokens);
          usage.outputTokens = Number(metrics.outputTokens ?? metrics.output_tokens ?? usage.outputTokens);
          usage.cachedInputTokens = Number(metrics.cachedInputTokens ?? metrics.cached_input_tokens ?? usage.cachedInputTokens);

          const reportedModel =
            asString(update.model, "") ||
            asString((typeof update.turn === "object" && update.turn !== null ? (update.turn as Record<string, unknown>).model : undefined), "");
          if (reportedModel) {
            model = reportedModel;
            provider = inferProviderFromModel(model);
          }

          const reportedCost = update.costUsd;
          if (typeof reportedCost === "number" && Number.isFinite(reportedCost)) {
            costUsd = reportedCost;
          }

          const errorText = readTextValue(update.error ?? (typeof update.result === "object" && update.result !== null ? (update.result as Record<string, unknown>).error : undefined));
          if (errorText) errors.push(errorText);

          notificationHandlers.delete(handler);
          resolve({ usage, errors, costUsd, model, provider });
        }
      };

      notificationHandlers.add(handler);
    });

    await request("session/prompt", {
      sessionId,
      content: [
        {
          type: "text",
          text: options.prompt,
        },
      ],
      ...(typeof options.maxTurnsPerRun === "number" && options.maxTurnsPerRun > 0
        ? { maxTurns: options.maxTurnsPerRun }
        : {}),
    });

    promptOutcome = await turnDonePromise;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    for (const pendingRequest of pending.values()) {
      pendingRequest.reject(new Error("Kiro ACP process terminated before request completed"));
    }
    pending.clear();
    child.kill("SIGTERM");
    await closePromise.catch(() => undefined);
    if (stdoutBuffer.trim()) {
      await flushLine(stdoutBuffer.trim());
      stdoutBuffer = "";
    }
  }

  return {
    stdout,
    stderr,
    exitCode,
    signal,
    timedOut,
    promptOutcome,
    sessionId,
  };
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, context, onLog, onMeta, authToken } = ctx;

  let config;
  try {
    config = extractConfig(ctx.config);
  } catch (error) {
    return {
      exitCode: null,
      signal: null,
      timedOut: false,
      errorCode: /absolute path/.test(String(error)) ? "relative_cwd" : "invalid_cwd",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  const cwd = config.cwd;
  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
  } catch (error) {
    return {
      exitCode: null,
      signal: null,
      timedOut: false,
      errorCode: /absolute path/.test(String(error)) ? "relative_cwd" : "invalid_cwd",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  await ensureKiroSkillsInjected(onLog);

  const env: Record<string, string> = {
    ...buildPaperclipEnv(agent),
    PAPERCLIP_RUN_ID: runId,
  };
  if (typeof context.taskId === "string" && context.taskId.trim()) env.PAPERCLIP_TASK_ID = context.taskId.trim();
  else if (typeof context.issueId === "string" && context.issueId.trim()) env.PAPERCLIP_TASK_ID = context.issueId.trim();
  if (typeof context.wakeReason === "string" && context.wakeReason.trim()) env.PAPERCLIP_WAKE_REASON = context.wakeReason.trim();
  if (typeof context.wakeCommentId === "string" && context.wakeCommentId.trim()) env.PAPERCLIP_WAKE_COMMENT_ID = context.wakeCommentId.trim();
  else if (typeof context.commentId === "string" && context.commentId.trim()) env.PAPERCLIP_WAKE_COMMENT_ID = context.commentId.trim();
  if (typeof context.approvalId === "string" && context.approvalId.trim()) env.PAPERCLIP_APPROVAL_ID = context.approvalId.trim();
  if (typeof context.approvalStatus === "string" && context.approvalStatus.trim()) env.PAPERCLIP_APPROVAL_STATUS = context.approvalStatus.trim();
  if (Array.isArray(context.issueIds)) {
    const issueIds = context.issueIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (issueIds.length > 0) env.PAPERCLIP_LINKED_ISSUE_IDS = issueIds.join(",");
  }
  for (const [key, value] of Object.entries(config.env ?? {})) {
    if (typeof value === "string" && value.length > 0) env[key] = value;
  }
  if (!env.PAPERCLIP_API_KEY && authToken) {
    env.PAPERCLIP_API_KEY = authToken;
  }

  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  try {
    await ensureCommandResolvable(config.command ?? "kiro-cli", cwd, runtimeEnv);
  } catch (error) {
    return {
      exitCode: null,
      signal: null,
      timedOut: false,
      errorCode: "command_not_found",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  const runtimeSessionParams =
    typeof runtime.sessionParams === "object" && runtime.sessionParams !== null && !Array.isArray(runtime.sessionParams)
      ? runtime.sessionParams
      : {};
  const storedSessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "");
  const storedSessionCwd = asString(runtimeSessionParams.cwd, "");
  const resumeSessionId =
    storedSessionId &&
    (!storedSessionCwd || path.resolve(storedSessionCwd) === path.resolve(cwd))
      ? storedSessionId
      : null;
  if (storedSessionId && !resumeSessionId) {
    await onLog(
      "stderr",
      `[paperclip] Kiro session "${storedSessionId}" was saved for cwd "${storedSessionCwd}" and will not be resumed in "${cwd}".\n`,
    );
  }

  const instructionsFilePath = (config.instructionsFilePath ?? "").trim();
  let instructionsPrefix = "";
  let instructionsChars = 0;
  if (instructionsFilePath) {
    try {
      const contents = await fs.readFile(instructionsFilePath, "utf8");
      instructionsPrefix = [
        contents.trim(),
        "",
        `The above agent instructions were loaded from ${instructionsFilePath}. Resolve relative file references from ${path.dirname(instructionsFilePath)}.`,
      ].join("\n");
      instructionsChars = instructionsPrefix.length;
      await onLog("stdout", `[paperclip] Loaded agent instructions file: ${instructionsFilePath}\n`);
    } catch (error) {
      await onLog(
        "stderr",
        `[paperclip] Warning: could not read agent instructions file "${instructionsFilePath}": ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }

  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };
  const renderedPrompt = renderTemplate(
    config.promptTemplate ?? "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
    templateData,
  );
  const renderedBootstrapPrompt =
    !resumeSessionId && config.bootstrapPromptTemplate
      ? renderTemplate(config.bootstrapPromptTemplate, templateData).trim()
      : "";
  const sessionHandoffNote = asString(context.paperclipSessionHandoffMarkdown, "").trim();
  const prompt = joinPromptSections([
    instructionsPrefix,
    renderedBootstrapPrompt,
    sessionHandoffNote,
    renderedPrompt,
  ]);

  if (onMeta) {
    await onMeta({
      adapterType: "kiro_cli",
      command: config.command ?? "kiro-cli",
      cwd,
      commandArgs: ["acp", ...(config.extraArgs ?? [])],
      commandNotes: [
        "Paperclip talks to Kiro over the documented ACP JSON-RPC protocol.",
        "Paperclip injects skills into ~/.kiro/skills so Kiro can discover them without modifying the repo.",
      ],
      env: redactEnvForLogs(env),
      prompt,
      promptMetrics: {
        promptChars: prompt.length,
        instructionsChars,
        bootstrapPromptChars: renderedBootstrapPrompt.length,
        sessionHandoffChars: sessionHandoffNote.length,
        heartbeatPromptChars: renderedPrompt.length,
      },
      context,
    });
  }

  const billingType = resolveKiroBillingType(runtimeEnv as Record<string, string>);

  const attempt = async (sessionToResume: string | null) =>
    runKiroAcp(ctx, {
      command: config.command ?? "kiro-cli",
      args: ["acp", ...(config.extraArgs ?? [])],
      cwd,
      env,
      prompt,
      timeoutSec: config.timeoutSec ?? 0,
      graceSec: config.graceSec ?? 15,
      model: config.model,
      resumeSessionId: sessionToResume,
      maxTurnsPerRun: config.maxTurnsPerRun,
    });

  let clearSession = false;
  let run = await attempt(resumeSessionId);
  if (
    resumeSessionId &&
    !run.timedOut &&
    ((run.exitCode ?? 0) !== 0 || run.promptOutcome?.errors.length) &&
    isKiroUnknownSessionError(run.stdout, run.stderr)
  ) {
    await onLog(
      "stderr",
      `[paperclip] Kiro resume session "${resumeSessionId}" is unavailable; retrying with a fresh session.\n`,
    );
    clearSession = true;
    run = await attempt(null);
  }

  const parsed = parseKiroAcpOutput(run.stdout, run.stderr);
  const sessionId = run.sessionId ?? parsed.sessionId ?? null;
  const provider = run.promptOutcome?.provider ?? parsed.provider ?? inferProviderFromModel(config.model ?? null) ?? "kiro";
  const model = run.promptOutcome?.model ?? parsed.model ?? config.model ?? null;
  const resultUsage = run.promptOutcome?.usage ?? parsed.usage;
  const costUsd = run.promptOutcome?.costUsd ?? parsed.costUsd ?? null;
  const errors = run.promptOutcome?.errors ?? [];

  if (run.timedOut) {
    return {
      exitCode: run.exitCode,
      signal: run.signal,
      timedOut: true,
      errorCode: "timeout",
      errorMessage: `Timed out after ${config.timeoutSec ?? 0}s`,
      resultJson: {
        stdout: run.stdout,
        stderr: run.stderr,
      },
      clearSession,
    };
  }

  const stderrLine = firstNonEmptyLine(run.stderr);
  const promptError = errors.find(Boolean) ?? "";
  const parsedError = parsed.errorMessage ?? "";
  const errorMessage =
    (run.exitCode ?? 0) === 0 && !promptError && !parsedError
      ? null
      : promptError || parsedError || stderrLine || `Kiro exited with code ${run.exitCode ?? -1}`;

  const errorCode =
    errorMessage === null
      ? undefined
      : clearSession && errorMessage
        ? "unknown_session"
        : promptError || parsedError
          ? "process_error"
          : "process_error";

  return {
    exitCode: run.exitCode,
    signal: run.signal,
    timedOut: false,
    errorCode,
    errorMessage,
    usage: resultUsage,
    sessionId,
    sessionParams: sessionId
      ? {
          sessionId,
          cwd,
        }
      : null,
    sessionDisplayId: sessionId,
    provider,
    biller: resolveKiroBiller(runtimeEnv as Record<string, string>, billingType, provider),
    model,
    billingType,
    costUsd,
    resultJson: {
      stdout: run.stdout,
      stderr: run.stderr,
    },
    summary: parsed.summary,
    clearSession,
  };
}
