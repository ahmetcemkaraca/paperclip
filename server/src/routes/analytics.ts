import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { analyticsService } from "../services/analytics.js";
import { assertCompanyAccess } from "./authz.js";

export function analyticsRoutes(db: Db) {
  const router = Router();
  const analytics = analyticsService(db);

  function parseDateRange(query: Record<string, unknown>) {
    const fromRaw = query.from as string | undefined;
    const toRaw = query.to as string | undefined;
    const days = query.days ? parseInt(query.days as string, 10) : 30;

    if (fromRaw && toRaw) {
      return {
        from: new Date(fromRaw),
        to: new Date(toRaw),
      };
    }

    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  router.get("/companies/:companyId/analytics/overview", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const result = await analytics.getOverview(companyId);
    res.json(result);
  });

  router.get("/companies/:companyId/analytics/costs/trend", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const range = parseDateRange(req.query as Record<string, unknown>);
    const result = await analytics.getCostTrend(companyId, range);
    res.json(result);
  });

  router.get("/companies/:companyId/analytics/agents/performance", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const result = await analytics.getAgentPerformance(companyId);
    res.json(result);
  });

  router.get("/companies/:companyId/analytics/tasks/velocity", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const range = parseDateRange(req.query as Record<string, unknown>);
    const result = await analytics.getTaskVelocity(companyId, range);
    res.json(result);
  });

  router.get("/companies/:companyId/analytics/activity/heatmap", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const range = parseDateRange(req.query as Record<string, unknown>);
    const result = await analytics.getActivityHeatmap(companyId, range);
    res.json(result);
  });

  router.get("/companies/:companyId/analytics/projects/progress", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const result = await analytics.getProjectProgress(companyId);
    res.json(result);
  });

  return router;
}