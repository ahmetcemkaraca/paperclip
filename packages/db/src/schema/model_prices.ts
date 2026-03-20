import { pgTable, uuid, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const modelPrices = pgTable(
  "model_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelName: text("model_name").notNull(),
    inputCostPerMillion: integer("input_cost_per_million").notNull().default(0), // cents/1M token
    outputCostPerMillion: integer("output_cost_per_million").notNull().default(0),
    cachedInputCostPerMillion: integer("cached_input_cost_per_million").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    modelNameIdx: uniqueIndex("model_prices_model_name_idx").on(table.modelName),
  }),
);
