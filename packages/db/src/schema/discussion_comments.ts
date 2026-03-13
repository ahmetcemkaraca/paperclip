import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { discussions } from "./discussions.js";
import { agents } from "./agents.js";

export const discussionComments = pgTable(
  "discussion_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    discussionId: uuid("discussion_id").notNull().references(() => discussions.id),
    authorAgentId: uuid("author_agent_id").references(() => agents.id),
    authorUserId: text("author_user_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    discussionIdx: index("discussion_comments_discussion_idx").on(table.discussionId),
    companyIdx: index("discussion_comments_company_idx").on(table.companyId),
    companyDiscussionCreatedAtIdx: index("discussion_comments_company_discussion_created_at_idx").on(
      table.companyId,
      table.discussionId,
      table.createdAt,
    ),
    companyAuthorDiscussionCreatedAtIdx: index("discussion_comments_company_author_discussion_created_at_idx").on(
      table.companyId,
      table.authorUserId,
      table.discussionId,
      table.createdAt,
    ),
  }),
);
