import { eq, inArray, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { modelPrices, costEvents } from "@paperclipai/db";

export interface ModelPrice {
  id: string;
  modelName: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  cachedInputCostPerMillion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComputeCostInput {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface ModelPriceData {
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  cachedInputCostPerMillion: number;
}

/**
 * Computes cost in cents based on token usage and pricing
 * Formula: (tokens * costPerMillion) / 1,000,000
 */
export function computeCostCents(
  input: ComputeCostInput,
  price: ModelPriceData,
): number {
  return Math.round(
    (input.inputTokens * price.inputCostPerMillion +
      input.outputTokens * price.outputCostPerMillion +
      input.cachedInputTokens * price.cachedInputCostPerMillion) /
      1_000_000,
  );
}

export function modelPriceService(db: Db) {
  return {
    /**
     * List all model prices
     */
    list: () => db.select().from(modelPrices).orderBy(modelPrices.modelName),

    /**
     * Get price for a specific model
     */
    getByModel: async (modelName: string): Promise<ModelPrice | null> => {
      const rows = await db
        .select()
        .from(modelPrices)
        .where(eq(modelPrices.modelName, modelName));
      return rows[0] ?? null;
    },

    /**
     * Upsert (insert or update) a model price
     */
    upsert: async (modelName: string, data: ModelPriceData): Promise<ModelPrice> => {
      const now = new Date();
      await db
        .insert(modelPrices)
        .values({
          modelName,
          ...data,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: modelPrices.modelName,
          set: {
            ...data,
            updatedAt: now,
          },
        });

      const result = await db
        .select()
        .from(modelPrices)
        .where(eq(modelPrices.modelName, modelName));
      return result[0]!;
    },

    /**
     * Delete a model price
     */
    delete: (modelName: string) =>
      db.delete(modelPrices).where(eq(modelPrices.modelName, modelName)),

    /**
     * Recalculate costCents for all cost_events with costCents=0
     * and a model that has a defined price
     */
    recalculate: async (): Promise<{ updatedCount: number }> => {
      const prices = await db.select().from(modelPrices);
      if (!prices.length) {
        return { updatedCount: 0 };
      }

      const modelNames = prices.map((p) => p.modelName);
      const priceMap = new Map<string, ModelPrice>(
        prices.map((p) => [p.modelName, p]),
      );

      // Find all cost_events with costCents=0 and model in our price list
      const rows = await db
        .select({
          id: costEvents.id,
          model: costEvents.model,
          inputTokens: costEvents.inputTokens,
          outputTokens: costEvents.outputTokens,
          cachedInputTokens: costEvents.cachedInputTokens,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.costCents, 0),
            inArray(costEvents.model, modelNames),
          ),
        );

      let updatedCount = 0;
      for (const row of rows) {
        const price = priceMap.get(row.model);
        if (!price) continue;

        const newCents = computeCostCents(
          {
            inputTokens: row.inputTokens,
            outputTokens: row.outputTokens,
            cachedInputTokens: row.cachedInputTokens ?? 0,
          },
          {
            inputCostPerMillion: price.inputCostPerMillion,
            outputCostPerMillion: price.outputCostPerMillion,
            cachedInputCostPerMillion: price.cachedInputCostPerMillion,
          },
        );

        if (newCents <= 0) continue;

        await db
          .update(costEvents)
          .set({ costCents: newCents })
          .where(eq(costEvents.id, row.id));

        updatedCount++;
      }

      return { updatedCount };
    },
  };
}
