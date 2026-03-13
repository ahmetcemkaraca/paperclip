import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { discussions, discussionComments } from "@paperclipai/db";
import { notFound } from "../errors.js";

export function discussionService(db: Db) {
  type DiscussionRecord = typeof discussions.$inferSelect;
  type DiscussionCommentRecord = typeof discussionComments.$inferSelect;

  return {
    list: (companyId: string) =>
      db
        .select()
        .from(discussions)
        .where(eq(discussions.companyId, companyId))
        .orderBy(asc(discussions.createdAt)),

    getById: (id: string) =>
      db
        .select()
        .from(discussions)
        .where(eq(discussions.id, id))
        .then((rows) => rows[0] ?? null),

    create: (companyId: string, data: Omit<typeof discussions.$inferInsert, "id" | "companyId" | "createdAt" | "updatedAt">) =>
      db
        .insert(discussions)
        .values({
          ...data,
          companyId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .then((rows) => rows[0]),

    addComment: (discussionId: string, data: Omit<typeof discussionComments.$inferInsert, "id" | "companyId" | "discussionId" | "createdAt" | "updatedAt">) => {
      return db
        .select()
        .from(discussions)
        .where(eq(discussions.id, discussionId))
        .then(async (discussions_rows) => {
          if (discussions_rows.length === 0) throw notFound("Discussion not found");
          const discussion = discussions_rows[0];
          return db
            .insert(discussionComments)
            .values({
              ...data,
              companyId: discussion.companyId,
              discussionId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning()
            .then((rows) => rows[0]);
        });
    },

    listComments: (discussionId: string) =>
      db
        .select()
        .from(discussionComments)
        .where(eq(discussionComments.discussionId, discussionId))
        .orderBy(asc(discussionComments.createdAt)),
  };
}
