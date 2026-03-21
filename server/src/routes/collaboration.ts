import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { collaborationService } from "../services/collaboration.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { logActivity } from "../services/activity-log.js";

export function collaborationRoutes(db: Db) {
  const router = Router();
  const collaboration = collaborationService(db);

  router.post("/companies/:companyId/collaborations", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    if (req.actor.type !== "agent") {
      res.status(403).json({ error: "Only agents can create collaborations" });
      return;
    }

    const result = await collaboration.createCollaboration(
      companyId,
      req.actor.agentId!,
      req.body
    );

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "collaboration.created",
      entityType: "agent_collaboration",
      entityId: result.id,
      details: { kind: result.kind, collaboratorAgentId: result.collaboratorAgentId },
    });

    res.status(201).json(result);
  });

  router.get("/companies/:companyId/collaborations", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const filters = {
      agentId: req.query.agentId as string | undefined,
      status: req.query.status as any,
      kind: req.query.kind as any,
    };

    const result = await collaboration.listCollaborations(companyId, filters);
    res.json(result);
  });

  router.get("/companies/:companyId/collaborations/:id", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const result = await collaboration.getCollaboration(companyId, req.params.id);
    if (!result) {
      res.status(404).json({ error: "Collaboration not found" });
      return;
    }
    res.json(result);
  });

  router.post("/companies/:companyId/collaborations/:id/respond", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    if (req.actor.type !== "agent") {
      res.status(403).json({ error: "Only agents can respond to collaborations" });
      return;
    }

    const result = await collaboration.respondToCollaboration(
      companyId,
      req.params.id,
      req.actor.agentId!,
      req.body
    );

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "collaboration.responded",
      entityType: "agent_collaboration",
      entityId: result.id,
      details: { status: result.status },
    });

    res.json(result);
  });

  router.post("/companies/:companyId/collaborations/:id/complete", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    if (req.actor.type !== "agent") {
      res.status(403).json({ error: "Only agents can complete collaborations" });
      return;
    }

    const result = await collaboration.completeCollaboration(
      companyId,
      req.params.id,
      req.actor.agentId!
    );

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "collaboration.completed",
      entityType: "agent_collaboration",
      entityId: result.id,
    });

    res.json(result);
  });

  router.post("/companies/:companyId/reviews", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    if (req.actor.type !== "agent") {
      res.status(403).json({ error: "Only agents can create reviews" });
      return;
    }

    const result = await collaboration.createReview(
      companyId,
      req.actor.agentId!,
      req.body
    );

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "review.created",
      entityType: "agent_review",
      entityId: result.id,
      details: { reviewType: result.reviewType, reviewerAgentId: result.reviewerAgentId },
    });

    res.status(201).json(result);
  });

  router.get("/companies/:companyId/reviews", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const filters = {
      agentId: req.query.agentId as string | undefined,
      status: req.query.status as any,
      type: req.query.type as any,
    };

    const result = await collaboration.listReviews(companyId, filters);
    res.json(result);
  });

  router.get("/companies/:companyId/reviews/:id", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const result = await collaboration.getReview(companyId, req.params.id);
    if (!result) {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    res.json(result);
  });

  router.post("/companies/:companyId/reviews/:id/start", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    if (req.actor.type !== "agent") {
      res.status(403).json({ error: "Only agents can start reviews" });
      return;
    }

    const result = await collaboration.startReview(
      companyId,
      req.params.id,
      req.actor.agentId!
    );

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "review.started",
      entityType: "agent_review",
      entityId: result.id,
    });

    res.json(result);
  });

  router.post("/companies/:companyId/reviews/:id/complete", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    if (req.actor.type !== "agent") {
      res.status(403).json({ error: "Only agents can complete reviews" });
      return;
    }

    const result = await collaboration.completeReview(
      companyId,
      req.params.id,
      req.actor.agentId!,
      req.body
    );

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "review.completed",
      entityType: "agent_review",
      entityId: result.id,
      details: { status: result.status },
    });

    res.json(result);
  });

  return router;
}