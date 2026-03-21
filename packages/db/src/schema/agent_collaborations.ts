import { pgTable, pgEnum, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";

export const collaborationKindEnum = pgEnum("collaboration_kind", [
  "delegation",
  "assistance",
  "review",
  "pair_programming",
]);

export const collaborationStatusEnum = pgEnum("collaboration_status", [
  "pending",
  "accepted",
  "declined",
  "completed",
  "cancelled",
]);

export const reviewTypeEnum = pgEnum("review_type", [
  "code_review",
  "output_review",
  "process_review",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "requested",
  "in_progress",
  "approved",
  "changes_requested",
  "cancelled",
]);

export const agentCollaborations = pgTable(
  "agent_collaborations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    initiatorAgentId: uuid("initiator_agent_id").notNull().references(() => agents.id),
    collaboratorAgentId: uuid("collaborator_agent_id").notNull().references(() => agents.id),
    issueId: uuid("issue_id").references(() => issues.id),
    kind: collaborationKindEnum("kind").notNull(),
    status: collaborationStatusEnum("status").notNull().default("pending"),
    requestMessage: text("request_message").notNull(),
    responseMessage: text("response_message"),
    dueBy: timestamp("due_by", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("agent_collaborations_company_idx").on(table.companyId),
    initiatorIdx: index("agent_collaborations_initiator_idx").on(table.initiatorAgentId),
    collaboratorIdx: index("agent_collaborations_collaborator_idx").on(table.collaboratorAgentId),
    issueIdx: index("agent_collaborations_issue_idx").on(table.issueId),
    statusIdx: index("agent_collaborations_status_idx").on(table.status),
  }),
);

export const agentReviews = pgTable(
  "agent_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    reviewerAgentId: uuid("reviewer_agent_id").notNull().references(() => agents.id),
    revieweeAgentId: uuid("reviewee_agent_id").notNull().references(() => agents.id),
    issueId: uuid("issue_id").references(() => issues.id),
    reviewType: reviewTypeEnum("review_type").notNull(),
    status: reviewStatusEnum("status").notNull().default("requested"),
    feedback: text("feedback"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("agent_reviews_company_idx").on(table.companyId),
    reviewerIdx: index("agent_reviews_reviewer_idx").on(table.reviewerAgentId),
    revieweeIdx: index("agent_reviews_reviewee_idx").on(table.revieweeAgentId),
    issueIdx: index("agent_reviews_issue_idx").on(table.issueId),
    statusIdx: index("agent_reviews_status_idx").on(table.status),
  }),
);