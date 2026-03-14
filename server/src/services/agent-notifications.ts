import { desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  approvalComments,
  approvals,
  discussionComments,
  discussions,
  issueComments,
  issues,
} from "@paperclipai/db";
import { normalizeAgentUrlKey } from "@paperclipai/shared";

export type AgentMentionNotificationType =
  | "issue_comment"
  | "issue_text"
  | "discussion_comment"
  | "discussion_text"
  | "approval_comment";

export interface AgentMentionNotification {
  id: string;
  type: AgentMentionNotificationType;
  companyId: string;
  createdAt: Date;
  excerpt: string;
  issueId?: string | null;
  issueTitle?: string | null;
  discussionId?: string | null;
  discussionTitle?: string | null;
  approvalId?: string | null;
  authorAgentId?: string | null;
  authorUserId?: string | null;
}

function excerpt(value: string | null | undefined, max = 240) {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function extractMentionTokens(text: string): Set<string> {
  const re = /\B@([^\s@,!?.:;()]+)/g;
  const tokens = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const token = match[1]?.trim().toLowerCase();
    if (token) tokens.add(token);
  }
  return tokens;
}

function mentionsAgent(text: string | null | undefined, aliases: Set<string>) {
  if (!text || aliases.size === 0) return false;
  const tokens = extractMentionTokens(text);
  for (const token of tokens) {
    if (aliases.has(token)) return true;
  }
  return false;
}

export function agentNotificationService(db: Db) {
  return {
    listMentions: async (input: { companyId: string; agentId: string; limit?: number }) => {
      const limit = Math.max(1, Math.min(200, Math.floor(input.limit ?? 50)));
      const scanLimit = Math.max(limit * 4, 120);

      const agent = await db
        .select({ id: agents.id, name: agents.name })
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .then((rows) => rows[0] ?? null);
      if (!agent) return [];

      const aliases = new Set<string>();
      const normalizedName = agent.name.trim().toLowerCase();
      if (normalizedName) aliases.add(normalizedName);
      const normalizedUrlKey = normalizeAgentUrlKey(agent.name);
      if (normalizedUrlKey) aliases.add(normalizedUrlKey.toLowerCase());

      const [issueCommentRows, issueRows, discussionCommentRows, discussionRows, approvalCommentRows] =
        await Promise.all([
          db
            .select({
              id: issueComments.id,
              companyId: issueComments.companyId,
              issueId: issueComments.issueId,
              body: issueComments.body,
              createdAt: issueComments.createdAt,
              authorAgentId: issueComments.authorAgentId,
              authorUserId: issueComments.authorUserId,
              issueTitle: issues.title,
            })
            .from(issueComments)
            .innerJoin(issues, eq(issues.id, issueComments.issueId))
            .where(eq(issueComments.companyId, input.companyId))
            .orderBy(desc(issueComments.createdAt))
            .limit(scanLimit),
          db
            .select({
              id: issues.id,
              companyId: issues.companyId,
              title: issues.title,
              description: issues.description,
              createdAt: issues.createdAt,
              authorAgentId: issues.createdByAgentId,
              authorUserId: issues.createdByUserId,
            })
            .from(issues)
            .where(eq(issues.companyId, input.companyId))
            .orderBy(desc(issues.createdAt))
            .limit(scanLimit),
          db
            .select({
              id: discussionComments.id,
              companyId: discussionComments.companyId,
              discussionId: discussionComments.discussionId,
              body: discussionComments.body,
              createdAt: discussionComments.createdAt,
              authorAgentId: discussionComments.authorAgentId,
              authorUserId: discussionComments.authorUserId,
              discussionTitle: discussions.title,
            })
            .from(discussionComments)
            .innerJoin(discussions, eq(discussions.id, discussionComments.discussionId))
            .where(eq(discussionComments.companyId, input.companyId))
            .orderBy(desc(discussionComments.createdAt))
            .limit(scanLimit),
          db
            .select({
              id: discussions.id,
              companyId: discussions.companyId,
              title: discussions.title,
              description: discussions.description,
              createdAt: discussions.createdAt,
              authorAgentId: discussions.authorAgentId,
              authorUserId: discussions.authorUserId,
            })
            .from(discussions)
            .where(eq(discussions.companyId, input.companyId))
            .orderBy(desc(discussions.createdAt))
            .limit(scanLimit),
          db
            .select({
              id: approvalComments.id,
              companyId: approvalComments.companyId,
              approvalId: approvalComments.approvalId,
              body: approvalComments.body,
              createdAt: approvalComments.createdAt,
              authorAgentId: approvalComments.authorAgentId,
              authorUserId: approvalComments.authorUserId,
              approvalType: approvals.type,
            })
            .from(approvalComments)
            .innerJoin(approvals, eq(approvals.id, approvalComments.approvalId))
            .where(eq(approvalComments.companyId, input.companyId))
            .orderBy(desc(approvalComments.createdAt))
            .limit(scanLimit),
        ]);

      const notifications: AgentMentionNotification[] = [];

      for (const row of issueCommentRows) {
        if (row.authorAgentId === input.agentId) continue;
        if (!mentionsAgent(row.body, aliases)) continue;
        notifications.push({
          id: row.id,
          type: "issue_comment",
          companyId: row.companyId,
          createdAt: row.createdAt,
          excerpt: excerpt(row.body),
          issueId: row.issueId,
          issueTitle: row.issueTitle,
          authorAgentId: row.authorAgentId,
          authorUserId: row.authorUserId,
        });
      }

      for (const row of issueRows) {
        if (row.authorAgentId === input.agentId) continue;
        if (!mentionsAgent(`${row.title}\n${row.description ?? ""}`, aliases)) continue;
        notifications.push({
          id: row.id,
          type: "issue_text",
          companyId: row.companyId,
          createdAt: row.createdAt,
          excerpt: excerpt(`${row.title}${row.description ? ` - ${row.description}` : ""}`),
          issueId: row.id,
          issueTitle: row.title,
          authorAgentId: row.authorAgentId,
          authorUserId: row.authorUserId,
        });
      }

      for (const row of discussionCommentRows) {
        if (row.authorAgentId === input.agentId) continue;
        if (!mentionsAgent(row.body, aliases)) continue;
        notifications.push({
          id: row.id,
          type: "discussion_comment",
          companyId: row.companyId,
          createdAt: row.createdAt,
          excerpt: excerpt(row.body),
          discussionId: row.discussionId,
          discussionTitle: row.discussionTitle,
          authorAgentId: row.authorAgentId,
          authorUserId: row.authorUserId,
        });
      }

      for (const row of discussionRows) {
        if (row.authorAgentId === input.agentId) continue;
        if (!mentionsAgent(`${row.title}\n${row.description ?? ""}`, aliases)) continue;
        notifications.push({
          id: row.id,
          type: "discussion_text",
          companyId: row.companyId,
          createdAt: row.createdAt,
          excerpt: excerpt(`${row.title}${row.description ? ` - ${row.description}` : ""}`),
          discussionId: row.id,
          discussionTitle: row.title,
          authorAgentId: row.authorAgentId,
          authorUserId: row.authorUserId,
        });
      }

      for (const row of approvalCommentRows) {
        if (row.authorAgentId === input.agentId) continue;
        if (!mentionsAgent(row.body, aliases)) continue;
        notifications.push({
          id: row.id,
          type: "approval_comment",
          companyId: row.companyId,
          createdAt: row.createdAt,
          excerpt: excerpt(row.body),
          approvalId: row.approvalId,
          authorAgentId: row.authorAgentId,
          authorUserId: row.authorUserId,
        });
      }

      notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return notifications.slice(0, limit);
    },
  };
}
