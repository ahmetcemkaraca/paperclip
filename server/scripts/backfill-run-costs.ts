import { eq, inArray, sql } from "drizzle-orm";
import { createDb, agents, companies, costEvents, heartbeatRuns } from "@paperclipai/db";
import { estimateUsageCostUsd } from "@paperclipai/adapter-utils";

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readUsageTotals(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return null;
  const inputTokens = Math.max(0, Math.floor(asNumber(payload.rawInputTokens, asNumber(payload.inputTokens, 0))));
  const cachedInputTokens = Math.max(0, Math.floor(asNumber(payload.rawCachedInputTokens, asNumber(payload.cachedInputTokens, 0))));
  const outputTokens = Math.max(0, Math.floor(asNumber(payload.rawOutputTokens, asNumber(payload.outputTokens, 0))));
  return inputTokens || cachedInputTokens || outputTokens
    ? { inputTokens, cachedInputTokens, outputTokens }
    : null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for backfill");

  const db = createDb(url);
  const runs = await db
    .select()
    .from(heartbeatRuns)
    .where(inArray(heartbeatRuns.status, ["succeeded", "failed", "cancelled", "timed_out"]));

  const runIds = runs.map((run) => run.id);
  const existing = runIds.length
    ? await db
        .select({ heartbeatRunId: costEvents.heartbeatRunId })
        .from(costEvents)
        .where(inArray(costEvents.heartbeatRunId, runIds))
    : [];
  const existingIds = new Set(existing.map((row) => row.heartbeatRunId).filter((value): value is string => !!value));

  const toInsert: Array<typeof costEvents.$inferInsert> = [];
  let skippedNoData = 0;

  for (const run of runs) {
    if (existingIds.has(run.id)) continue;

    const usage = parseObject(run.usageJson);
    const result = parseObject(run.resultJson);
    const usageTotals = readUsageTotals(usage);
    const explicitCost =
      [usage.costUsd, usage.cost_usd, usage.total_cost_usd, result.costUsd, result.cost_usd, result.total_cost_usd]
        .find((value) => typeof value === "number" && Number.isFinite(value)) as number | undefined;
    const model = typeof result.model === "string" ? result.model : typeof usage.model === "string" ? usage.model : null;
    const estimatedCostUsd =
      model && usageTotals
        ? estimateUsageCostUsd({
            model,
            usage: {
              inputTokens: usageTotals.inputTokens,
              cachedInputTokens: usageTotals.cachedInputTokens,
              outputTokens: usageTotals.outputTokens,
            },
          })
        : null;
    const costUsd = explicitCost ?? estimatedCostUsd ?? 0;
    const costCents = Math.max(0, Math.round(costUsd * 100));

    if (!usageTotals && costCents <= 0) {
      skippedNoData += 1;
      continue;
    }

    const agent = await db.select().from(agents).where(eq(agents.id, run.agentId)).then((rows) => rows[0] ?? null);
    if (!agent) continue;
    const company = await db.select().from(companies).where(eq(companies.id, run.companyId)).then((rows) => rows[0] ?? null);
    if (!company) continue;

    toInsert.push({
      companyId: run.companyId,
      agentId: run.agentId,
      heartbeatRunId: run.id,
      provider: typeof result.provider === "string" ? result.provider : "unknown",
      biller: typeof result.biller === "string" ? result.biller : typeof result.provider === "string" ? result.provider : "unknown",
      billingType: typeof result.billingType === "string" ? result.billingType : "unknown",
      model: typeof result.model === "string" ? result.model : "unknown",
      inputTokens: usageTotals?.inputTokens ?? 0,
      cachedInputTokens: usageTotals?.cachedInputTokens ?? 0,
      outputTokens: usageTotals?.outputTokens ?? 0,
      costCents,
      occurredAt: run.finishedAt ?? run.startedAt ?? run.createdAt,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(costEvents).values(toInsert);
  }

  const currentMonthStart = sql`date_trunc('month', now() at time zone 'utc') at time zone 'utc'`;
  const [agentSpendRows, companySpendRows] = await Promise.all([
    db
      .select({
        agentId: costEvents.agentId,
        spentMonthlyCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
      })
      .from(costEvents)
      .where(sql`${costEvents.occurredAt} >= ${currentMonthStart}`)
      .groupBy(costEvents.agentId),
    db
      .select({
        companyId: costEvents.companyId,
        spentMonthlyCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
      })
      .from(costEvents)
      .where(sql`${costEvents.occurredAt} >= ${currentMonthStart}`)
      .groupBy(costEvents.companyId),
  ]);

  await Promise.all([
    ...agentSpendRows.map((row) =>
      db.update(agents).set({ spentMonthlyCents: row.spentMonthlyCents, updatedAt: new Date() }).where(eq(agents.id, row.agentId)),
    ),
    ...companySpendRows.map((row) =>
      db.update(companies).set({ spentMonthlyCents: row.spentMonthlyCents, updatedAt: new Date() }).where(eq(companies.id, row.companyId)),
    ),
  ]);

  console.log(
    JSON.stringify({
      scannedRuns: runs.length,
      insertedCostEvents: toInsert.length,
      skippedBecauseNoCostData: skippedNoData,
      alreadyHadCostEvent: existingIds.size,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
