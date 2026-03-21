import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { workflowService } from "../services/workflow.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { logActivity } from "../services/activity-log.js";

export function workflowRoutes(db: Db) {
  const router = Router();
  const workflow = workflowService(db);

  router.post("/companies/:companyId/workflows", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const result = await workflow.createWorkflow(companyId, req.body);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "workflow.created",
      entityType: "workflow",
      entityId: result.id,
      details: { name: result.name, triggerKind: result.triggerConfig.kind },
    });

    res.status(201).json(result);
  });

  router.get("/companies/:companyId/workflows", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const filters = {
      status: req.query.status as any,
      isTemplate: req.query.isTemplate === "true" ? true : req.query.isTemplate === "false" ? false : undefined,
    };

    const result = await workflow.listWorkflows(companyId, filters);
    res.json(result);
  });

  router.get("/companies/:companyId/workflows/:id", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const result = await workflow.getWorkflow(companyId, req.params.id);
    if (!result) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.json(result);
  });

  router.patch("/companies/:companyId/workflows/:id", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const result = await workflow.updateWorkflow(companyId, req.params.id, req.body);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "workflow.updated",
      entityType: "workflow",
      entityId: result.id,
      details: { name: result.name },
    });

    res.json(result);
  });

  router.delete("/companies/:companyId/workflows/:id", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    await workflow.deleteWorkflow(companyId, req.params.id);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "workflow.deleted",
      entityType: "workflow",
      entityId: req.params.id,
    });

    res.status(204).send();
  });

  router.post("/companies/:companyId/workflows/:id/runs", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const result = await workflow.createRun(companyId, req.params.id);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "workflow_run.created",
      entityType: "workflow_run",
      entityId: result.id,
      details: { workflowId: result.workflowId },
    });

    res.status(201).json(result);
  });

  router.get("/companies/:companyId/workflows/:id/runs", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const result = await workflow.listRuns(companyId, req.params.id);
    res.json(result);
  });

  router.get("/companies/:companyId/workflow-runs/:runId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const result = await workflow.getRun(companyId, req.params.runId);
    if (!result) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    res.json(result);
  });

  router.get("/companies/:companyId/workflow-runs/:runId/steps", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const result = await workflow.getRunSteps(companyId, req.params.runId);
    res.json(result);
  });

  return router;
}