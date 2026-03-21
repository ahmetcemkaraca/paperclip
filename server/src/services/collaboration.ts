import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agentCollaborations,
  agentReviews,
  agents,
  issues,
} from "@paperclipai/db";
import { notFound, badRequest } from "../errors.js";
import type {
  AgentCollaboration,
  AgentCollaborationDetail,
  AgentReview,
  AgentReviewDetail,
  CreateCollaborationRequest,
  RespondToCollaborationRequest,
  CreateReviewRequest,
  CompleteReviewRequest,
  CollaborationKind,
  CollaborationStatus,
  ReviewType,
  ReviewStatus,
} from "@paperclipai/shared";

const VALID_COLLABORATION_KINDS: CollaborationKind[] = ["delegation", "assistance", "review", "pair_programming"];
const VALID_REVIEW_TYPES: ReviewType[] = ["code_review", "output_review", "process_review"];

function mapCollaboration(row: unknown): AgentCollaboration {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    companyId: r.companyId as string,
    initiatorAgentId: r.initiatorAgentId as string,
    collaboratorAgentId: r.collaboratorAgentId as string,
    issueId: r.issueId as string | null,
    kind: r.kind as CollaborationKind,
    status: r.status as CollaborationStatus,
    requestMessage: r.requestMessage as string,
    responseMessage: r.responseMessage as string | null,
    dueBy: r.dueBy ? new Date(r.dueBy as string).toISOString() : null,
    completedAt: r.completedAt ? new Date(r.completedAt as string).toISOString() : null,
    createdAt: new Date(r.createdAt as string).toISOString(),
    updatedAt: new Date(r.updatedAt as string).toISOString(),
  };
}

function mapReview(row: unknown): AgentReview {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    companyId: r.companyId as string,
    reviewerAgentId: r.reviewerAgentId as string,
    revieweeAgentId: r.revieweeAgentId as string,
    issueId: r.issueId as string | null,
    reviewType: r.reviewType as ReviewType,
    status: r.status as ReviewStatus,
    feedback: r.feedback as string | null,
    requestedAt: new Date(r.requestedAt as string).toISOString(),
    startedAt: r.startedAt ? new Date(r.startedAt as string).toISOString() : null,
    completedAt: r.completedAt ? new Date(r.completedAt as string).toISOString() : null,
    createdAt: new Date(r.createdAt as string).toISOString(),
    updatedAt: new Date(r.updatedAt as string).toISOString(),
  };
}

export function collaborationService(db: Db) {
  return {
    createCollaboration: async (
      companyId: string,
      initiatorAgentId: string,
      data: CreateCollaborationRequest
    ): Promise<AgentCollaboration> => {
      if (!VALID_COLLABORATION_KINDS.includes(data.kind)) {
        throw badRequest(`Invalid collaboration kind: ${data.kind}`);
      }

      const [initiator] = await db.select().from(agents).where(eq(agents.id, initiatorAgentId));
      if (!initiator || initiator.companyId !== companyId) {
        throw notFound("Initiator agent not found");
      }

      const [collaborator] = await db.select().from(agents).where(eq(agents.id, data.collaboratorAgentId));
      if (!collaborator || collaborator.companyId !== companyId) {
        throw notFound("Collaborator agent not found");
      }

      if (data.issueId) {
        const [issue] = await db.select().from(issues).where(eq(issues.id, data.issueId));
        if (!issue || issue.companyId !== companyId) {
          throw notFound("Issue not found");
        }
      }

      const [collaboration] = await db
        .insert(agentCollaborations)
        .values({
          companyId,
          initiatorAgentId,
          collaboratorAgentId: data.collaboratorAgentId,
          issueId: data.issueId ?? null,
          kind: data.kind,
          status: "pending",
          requestMessage: data.requestMessage,
          dueBy: data.dueBy ? new Date(data.dueBy) : null,
        })
        .returning();

      return mapCollaboration(collaboration);
    },

    getCollaboration: async (companyId: string, id: string): Promise<AgentCollaborationDetail | null> => {
      const rows = await db
        .select()
        .from(agentCollaborations)
        .where(and(eq(agentCollaborations.id, id), eq(agentCollaborations.companyId, companyId)));

      if (rows.length === 0) return null;

      const collaboration = rows[0];

      const [initiatorAgent] = await db
        .select({ id: agents.id, name: agents.name, role: agents.role })
        .from(agents)
        .where(eq(agents.id, collaboration.initiatorAgentId));

      const [collaboratorAgent] = await db
        .select({ id: agents.id, name: agents.name, role: agents.role })
        .from(agents)
        .where(eq(agents.id, collaboration.collaboratorAgentId));

      let issue: { id: string; title: string; status: string } | null = null;
      if (collaboration.issueId) {
        const [issueRow] = await db
          .select({ id: issues.id, title: issues.title, status: issues.status })
          .from(issues)
          .where(eq(issues.id, collaboration.issueId));
        issue = issueRow ? { id: issueRow.id, title: issueRow.title, status: issueRow.status } : null;
      }

      const base = mapCollaboration(collaboration);
      return {
        ...base,
        initiatorAgent: initiatorAgent ?? { id: collaboration.initiatorAgentId, name: "Unknown", role: "unknown" },
        collaboratorAgent: collaboratorAgent ?? { id: collaboration.collaboratorAgentId, name: "Unknown", role: "unknown" },
        issue,
      };
    },

    listCollaborations: async (
      companyId: string,
      filters?: { agentId?: string; status?: CollaborationStatus; kind?: CollaborationKind }
    ): Promise<AgentCollaboration[]> => {
      const conditions = [eq(agentCollaborations.companyId, companyId)];

      if (filters?.agentId) {
        conditions.push(eq(agentCollaborations.initiatorAgentId, filters.agentId));
      }
      if (filters?.status) {
        conditions.push(eq(agentCollaborations.status, filters.status));
      }
      if (filters?.kind) {
        conditions.push(eq(agentCollaborations.kind, filters.kind));
      }

      const rows = await db
        .select()
        .from(agentCollaborations)
        .where(and(...conditions))
        .orderBy(desc(agentCollaborations.createdAt));

      return rows.map(mapCollaboration);
    },

    respondToCollaboration: async (
      companyId: string,
      id: string,
      collaboratorAgentId: string,
      data: RespondToCollaborationRequest
    ): Promise<AgentCollaboration> => {
      const [collaboration] = await db
        .select()
        .from(agentCollaborations)
        .where(and(eq(agentCollaborations.id, id), eq(agentCollaborations.companyId, companyId)));

      if (!collaboration) {
        throw notFound("Collaboration not found");
      }

      if (collaboration.collaboratorAgentId !== collaboratorAgentId) {
        throw badRequest("Only the collaborator can respond to this request");
      }

      if (collaboration.status !== "pending") {
        throw badRequest("Collaboration is not in pending status");
      }

      const [updated] = await db
        .update(agentCollaborations)
        .set({
          status: data.status,
          responseMessage: data.responseMessage ?? null,
          updatedAt: new Date(),
        })
        .where(eq(agentCollaborations.id, id))
        .returning();

      return mapCollaboration(updated);
    },

    completeCollaboration: async (
      companyId: string,
      id: string,
      initiatorAgentId: string
    ): Promise<AgentCollaboration> => {
      const [collaboration] = await db
        .select()
        .from(agentCollaborations)
        .where(and(eq(agentCollaborations.id, id), eq(agentCollaborations.companyId, companyId)));

      if (!collaboration) {
        throw notFound("Collaboration not found");
      }

      if (collaboration.initiatorAgentId !== initiatorAgentId) {
        throw badRequest("Only the initiator can complete this collaboration");
      }

      if (collaboration.status !== "accepted") {
        throw badRequest("Collaboration must be accepted before completing");
      }

      const [updated] = await db
        .update(agentCollaborations)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agentCollaborations.id, id))
        .returning();

      return mapCollaboration(updated);
    },

    createReview: async (
      companyId: string,
      revieweeAgentId: string,
      data: CreateReviewRequest
    ): Promise<AgentReview> => {
      if (!VALID_REVIEW_TYPES.includes(data.reviewType)) {
        throw badRequest(`Invalid review type: ${data.reviewType}`);
      }

      const [reviewee] = await db.select().from(agents).where(eq(agents.id, revieweeAgentId));
      if (!reviewee || reviewee.companyId !== companyId) {
        throw notFound("Reviewee agent not found");
      }

      const [reviewer] = await db.select().from(agents).where(eq(agents.id, data.reviewerAgentId));
      if (!reviewer || reviewer.companyId !== companyId) {
        throw notFound("Reviewer agent not found");
      }

      if (data.issueId) {
        const [issue] = await db.select().from(issues).where(eq(issues.id, data.issueId));
        if (!issue || issue.companyId !== companyId) {
          throw notFound("Issue not found");
        }
      }

      const [review] = await db
        .insert(agentReviews)
        .values({
          companyId,
          reviewerAgentId: data.reviewerAgentId,
          revieweeAgentId,
          issueId: data.issueId ?? null,
          reviewType: data.reviewType,
          status: "requested",
        })
        .returning();

      return mapReview(review);
    },

    getReview: async (companyId: string, id: string): Promise<AgentReviewDetail | null> => {
      const rows = await db
        .select()
        .from(agentReviews)
        .where(and(eq(agentReviews.id, id), eq(agentReviews.companyId, companyId)));

      if (rows.length === 0) return null;

      const review = rows[0];

      const [reviewerAgent] = await db
        .select({ id: agents.id, name: agents.name, role: agents.role })
        .from(agents)
        .where(eq(agents.id, review.reviewerAgentId));

      const [revieweeAgent] = await db
        .select({ id: agents.id, name: agents.name, role: agents.role })
        .from(agents)
        .where(eq(agents.id, review.revieweeAgentId));

      let issue: { id: string; title: string; status: string } | null = null;
      if (review.issueId) {
        const [issueRow] = await db
          .select({ id: issues.id, title: issues.title, status: issues.status })
          .from(issues)
          .where(eq(issues.id, review.issueId));
        issue = issueRow ? { id: issueRow.id, title: issueRow.title, status: issueRow.status } : null;
      }

      const base = mapReview(review);
      return {
        ...base,
        reviewerAgent: reviewerAgent ?? { id: review.reviewerAgentId, name: "Unknown", role: "unknown" },
        revieweeAgent: revieweeAgent ?? { id: review.revieweeAgentId, name: "Unknown", role: "unknown" },
        issue,
      };
    },

    listReviews: async (
      companyId: string,
      filters?: { agentId?: string; status?: ReviewStatus; type?: ReviewType }
    ): Promise<AgentReview[]> => {
      const conditions = [eq(agentReviews.companyId, companyId)];

      if (filters?.agentId) {
        conditions.push(eq(agentReviews.revieweeAgentId, filters.agentId));
      }
      if (filters?.status) {
        conditions.push(eq(agentReviews.status, filters.status));
      }
      if (filters?.type) {
        conditions.push(eq(agentReviews.reviewType, filters.type));
      }

      const rows = await db
        .select()
        .from(agentReviews)
        .where(and(...conditions))
        .orderBy(desc(agentReviews.createdAt));

      return rows.map(mapReview);
    },

    startReview: async (companyId: string, id: string, reviewerAgentId: string): Promise<AgentReview> => {
      const [review] = await db
        .select()
        .from(agentReviews)
        .where(and(eq(agentReviews.id, id), eq(agentReviews.companyId, companyId)));

      if (!review) {
        throw notFound("Review not found");
      }

      if (review.reviewerAgentId !== reviewerAgentId) {
        throw badRequest("Only the assigned reviewer can start this review");
      }

      if (review.status !== "requested") {
        throw badRequest("Review is not in requested status");
      }

      const [updated] = await db
        .update(agentReviews)
        .set({
          status: "in_progress",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agentReviews.id, id))
        .returning();

      return mapReview(updated);
    },

    completeReview: async (
      companyId: string,
      id: string,
      reviewerAgentId: string,
      data: CompleteReviewRequest
    ): Promise<AgentReview> => {
      const [review] = await db
        .select()
        .from(agentReviews)
        .where(and(eq(agentReviews.id, id), eq(agentReviews.companyId, companyId)));

      if (!review) {
        throw notFound("Review not found");
      }

      if (review.reviewerAgentId !== reviewerAgentId) {
        throw badRequest("Only the assigned reviewer can complete this review");
      }

      if (review.status !== "in_progress") {
        throw badRequest("Review must be in progress before completing");
      }

      const [updated] = await db
        .update(agentReviews)
        .set({
          status: data.status,
          feedback: data.feedback ?? null,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agentReviews.id, id))
        .returning();

      return mapReview(updated);
    },
  };
}