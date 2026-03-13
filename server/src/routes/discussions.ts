import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  discussionService,
  logActivity,
} from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function discussionRoutes(db: Db) {
  const router = Router();
  const svc = discussionService(db);

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
