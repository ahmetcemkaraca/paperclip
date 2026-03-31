import { pgTable, uuid, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const tokenPricings = pgTable(
  "token_pricings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    adapterType: text("adapter_type"),
    model: text("model"),
    inputPricePerMillionCents: integer("input_price_per_million_cents").notNull().default(0),
    outputPricePerMillionCents: integer("output_price_per_million_cents").notNull().default(0),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("token_pricings_company_idx").on(table.companyId),
  }),
);
