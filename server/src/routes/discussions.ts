import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  discussionService,
  heartbeatService,
  issueService,
  logActivity,
} from "../services/index.js";
import { logger } from "../middleware/logger.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function discussionRoutes(db: Db) {
  const router = Router();
  const svc = discussionService(db);
  const heartbeat = heartbeatService(db);
  const issuesSvc = issueService(db);

  // List discussions for a company
  router.get("/companies/:companyId/discussions", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const discussions = await svc.list(companyId);
    res.json(discussions);
  });

  // Get a specific discussion
  router.get("/discussions/:id", async (req, res) => {
    const id = req.params.id as string;
    const discussion = await svc.getById(id);
    if (!discussion) {
      res.status(404).json({ error: "Discussion not found" });
      return;
    }
    assertCompanyAccess(req, discussion.companyId);
    res.json(discussion);
  });

  // Create a discussion
  router.post("/companies/:companyId/discussions", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    
    const { title, description } = req.body;
    if (!title || typeof title !== "string") {
      res.status(422).json({ error: "Title is required and must be a string" });
      return;
    }

    const actor = getActorInfo(req);
    const discussion = await svc.create(companyId, {
      title,
      description: description ?? null,
      authorAgentId: actor.agentId,
      authorUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "discussion.created",
      entityType: "discussion",
      entityId: discussion.id,
      details: { title },
    });

    const mentionSource = `${title}\n${description ?? ""}`;
    try {
      const mentionedIds = await issuesSvc.findMentionedAgents(companyId, mentionSource);
      for (const mentionedId of mentionedIds) {
        if (actor.actorType === "agent" && actor.actorId === mentionedId) continue;
        heartbeat.wakeup(mentionedId, {
          source: "automation",
          triggerDetail: "system",
          reason: "discussion_mentioned",
          payload: { discussionId: discussion.id },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: {
            source: "discussion.mention",
            discussionId: discussion.id,
            wakeReason: "discussion_mentioned",
          },
        }).catch((err) => logger.warn({ err, discussionId: discussion.id, mentionedId }, "failed to wake mentioned agent"));
      }
    } catch (err) {
      logger.warn({ err, discussionId: discussion.id }, "failed to resolve discussion mentions");
    }

    res.status(201).json(discussion);
  });

  // Add a comment to a discussion
  router.post("/discussions/:id/comments", async (req, res) => {
    const discussionId = req.params.id as string;
    const { body } = req.body;

    if (!body || typeof body !== "string") {
      res.status(422).json({ error: "Comment body is required and must be a string" });
      return;
    }

    const discussion = await svc.getById(discussionId);
    if (!discussion) {
      res.status(404).json({ error: "Discussion not found" });
      return;
    }
    assertCompanyAccess(req, discussion.companyId);

    const actor = getActorInfo(req);
    const comment = await svc.addComment(discussionId, {
      body,
      authorAgentId: actor.agentId,
      authorUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(db, {
      companyId: discussion.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "discussion.comment_added",
      entityType: "discussion",
      entityId: discussionId,
      details: { commentId: comment.id },
    });

    try {
      const mentionedIds = await issuesSvc.findMentionedAgents(discussion.companyId, body);
      for (const mentionedId of mentionedIds) {
        if (actor.actorType === "agent" && actor.actorId === mentionedId) continue;
        heartbeat.wakeup(mentionedId, {
          source: "automation",
          triggerDetail: "system",
          reason: "discussion_comment_mentioned",
          payload: { discussionId, commentId: comment.id },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: {
            source: "discussion.comment.mention",
            discussionId,
            commentId: comment.id,
            wakeReason: "discussion_comment_mentioned",
          },
        }).catch((err) => logger.warn({ err, discussionId, mentionedId }, "failed to wake mentioned agent"));
      }
    } catch (err) {
      logger.warn({ err, discussionId }, "failed to resolve discussion comment mentions");
    }

    res.status(201).json(comment);
  });

  // List comments for a discussion
  router.get("/discussions/:id/comments", async (req, res) => {
    const discussionId = req.params.id as string;
    const discussion = await svc.getById(discussionId);
    if (!discussion) {
      res.status(404).json({ error: "Discussion not found" });
      return;
    }
    assertCompanyAccess(req, discussion.companyId);

    const comments = await svc.listComments(discussionId);
    res.json(comments);
  });

  return router;
}
