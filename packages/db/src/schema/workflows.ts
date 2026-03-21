import { pgTable, uuid, text, timestamp, jsonb, integer, index, boolean } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),
    triggerConfig: jsonb("trigger_config").notNull().$type<{
      kind: "schedule" | "webhook" | "event" | "manual";
      config: {
        cronExpression?: string;
        timezone?: string;
        eventType?: string;
        eventFilter?: Record<string, unknown>;
      };
    }>(),
    nodes: jsonb("nodes").notNull().$type<Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      config: Record<string, unknown>;
    }>>(),
    edges: jsonb("edges").notNull().$type<Array<{
      id: string;
      sourceNodeId: string;
      targetNodeId: string;
      sourcePort?: string;
      condition?: Record<string, unknown>;
    }>>(),
    variables: jsonb("variables").$type<Record<string, unknown>>(),
    executionOrder: integer("execution_order").notNull().default(0),
    isTemplate: boolean("is_template").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("workflows_company_idx").on(table.companyId),
    statusIdx: index("workflows_status_idx").on(table.status),
    isTemplateIdx: index("workflows_is_template_idx").on(table.isTemplate),
  }),
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id").notNull().references(() => workflows.id),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    status: text("status").notNull().default("pending"),
    currentNodeId: text("current_node_id"),
    context: jsonb("context").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workflowIdx: index("workflow_runs_workflow_idx").on(table.workflowId),
    companyIdx: index("workflow_runs_company_idx").on(table.companyId),
    statusIdx: index("workflow_runs_status_idx").on(table.status),
  }),
);

export const workflowRunSteps = pgTable(
  "workflow_run_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => workflowRuns.id),
    nodeId: text("node_id").notNull(),
    nodeType: text("node_type").notNull(),
    status: text("status").notNull().default("pending"),
    input: jsonb("input").$type<Record<string, unknown>>(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runIdx: index("workflow_run_steps_run_idx").on(table.runId),
    statusIdx: index("workflow_run_steps_status_idx").on(table.status),
  }),
);