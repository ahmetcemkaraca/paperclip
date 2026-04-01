import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { tokenPricings, costEvents, heartbeatRuns, agents, companies } from "@paperclipai/db";
import { notFound } from "../errors.js";
import { budgetService } from "./budgets.js";

export function pricingService(db: Db) {
  return {
    create: async (companyId: string, input: {
      adapterType?: string | null;
      model?: string | null;
      inputPricePerMillionCents: number;
      outputPricePerMillionCents: number;
      effectiveFrom?: Date;
      active?: boolean;
    }) => {
      const row = await db
        .insert(tokenPricings)
        .values({
          companyId,
          adapterType: input.adapterType ?? null,
          model: input.model ?? null,
          inputPricePerMillionCents: input.inputPricePerMillionCents ?? 0,
          outputPricePerMillionCents: input.outputPricePerMillionCents ?? 0,
          effectiveFrom: input.effectiveFrom ?? new Date(),
          active: input.active ?? true,
        })
        .returning()
        .then((rows) => rows[0]);
      return row;
    },

    list: async (companyId: string) => {
      return db.select().from(tokenPricings).where(eq(tokenPricings.companyId, companyId)).orderBy(tokenPricings.effectiveFrom);
    },

    getEffectivePricing: async (companyId: string, adapterType: string | null | undefined, model: string | null | undefined) => {
      const now = new Date();
      // Try exact model+adapter match first
      if (adapterType && model) {
        const exact = await db
          .select()
          .from(tokenPricings)
          .where(
            and(
              eq(tokenPricings.companyId, companyId),
              eq(tokenPricings.adapterType, adapterType),
              eq(tokenPricings.model, model),
              eq(tokenPricings.active, true),
              sql`${tokenPricings.effectiveFrom} <= ${now}`,
            ),
          )
          .orderBy(tokenPricings.effectiveFrom, "desc")
          .then((rows) => rows[0] ?? null);
        if (exact) return exact;
      }

      // Try adapter-level match
      if (adapterType) {
        const ad = await db
          .select()
          .from(tokenPricings)
          .where(
            and(
              eq(tokenPricings.companyId, companyId),
              eq(tokenPricings.adapterType, adapterType),
              sql`${tokenPricings.model} is null`,
              eq(tokenPricings.active, true),
              sql`${tokenPricings.effectiveFrom} <= ${now}`,
            ),
          )
          .orderBy(tokenPricings.effectiveFrom, "desc")
          .then((rows) => rows[0] ?? null);
        if (ad) return ad;
      }

      return null;
    },

    recalculateCompanyCosts: async (companyId: string, opts?: { forceAll?: boolean }) => {
      const forceAll = Boolean(opts?.forceAll);

      // find candidate events
      const conditions = [eq(costEvents.companyId, companyId)];
      if (!forceAll) conditions.push(eq(costEvents.costCents, 0));
      conditions.push(sql`coalesce(${costEvents.inputTokens},0) + coalesce(${costEvents.outputTokens},0) > 0`);

      const events = await db
        .select({
          id: costEvents.id,
          agentId: costEvents.agentId,
          heartbeatRunId: costEvents.heartbeatRunId,
          inputTokens: costEvents.inputTokens,
          cachedInputTokens: costEvents.cachedInputTokens,
          outputTokens: costEvents.outputTokens,
          model: costEvents.model,
        })
        .from(costEvents)
        .where(and(...conditions));

      const budgets = budgetService(db);

      const affectedAgentIds = new Set<string>();

      for (const ev of events) {
        // find agent to get adapterType
        const agentRow = await db.select({ adapterType: agents.adapterType }).from(agents).where(eq(agents.id, ev.agentId)).then((r) => r[0] ?? null);
        const adapterType = agentRow?.adapterType ?? null;

        const pricing = await (async () => {
          const svc = pricingService(db);
          return svc.getEffectivePricing(companyId, adapterType, ev.model ?? null);
        })();

        if (!pricing) continue;

        const billableInput = Math.max(0, (ev.inputTokens ?? 0) - (ev.cachedInputTokens ?? 0));
        const fromInput = Math.round((billableInput / 1_000_000) * (pricing.inputPricePerMillionCents ?? 0));
        const fromOutput = Math.round(((ev.outputTokens ?? 0) / 1_000_000) * (pricing.outputPricePerMillionCents ?? 0));
        const computed = Math.max(0, fromInput + fromOutput);

        // update only if different
        await db
          .update(costEvents)
          .set({ costCents: computed, billingCode: "pricing_override_applied" })
          .where(eq(costEvents.id, ev.id));

        const [updated] = await db.select().from(costEvents).where(eq(costEvents.id, ev.id));
        if (updated) {
          // re-evaluate budgets for this event
          try {
            await budgets.evaluateCostEvent(updated as typeof costEvents.$inferSelect);
          } catch (e) {
            // ignore budget evaluation failures for batch job
          }
        }

        if (ev.agentId) affectedAgentIds.add(ev.agentId);
      }

      // recompute monthly totals for affected agents and company
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

      for (const aid of Array.from(affectedAgentIds)) {
        const [row] = await db
          .select({ total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int` })
          .from(costEvents)
          .where(and(eq(costEvents.companyId, companyId), eq(costEvents.agentId, aid), sql`${costEvents.occurredAt} >= ${start}`, sql`${costEvents.occurredAt} < ${end}`));
        const total = Number(row?.total ?? 0);
        await db.update(agents).set({ spentMonthlyCents: total, updatedAt: new Date() }).where(eq(agents.id, aid));
      }

      // update company total
      const [companyRow] = await db
        .select({ total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int` })
        .from(costEvents)
        .where(and(eq(costEvents.companyId, companyId), sql`${costEvents.occurredAt} >= ${start}`, sql`${costEvents.occurredAt} < ${end}`));
      const companyTotal = Number(companyRow?.total ?? 0);
      await db.update(companies).set({ spentMonthlyCents: companyTotal, updatedAt: new Date() }).where(eq(companies.id, companyId));

      return { updatedCount: events.length };
    },
  };
}
