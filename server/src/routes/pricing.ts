import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { pricingService, logActivity } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function pricingRoutes(db: Db) {
  const router = Router();
  const pricing = pricingService(db);

  router.get("/companies/:companyId/token-pricings", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const rows = await pricing.list(companyId);
    res.json(rows);
  });

  router.post("/companies/:companyId/token-pricings", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);

    const body = req.body ?? {};
    const adapterType = typeof body.adapterType === "string" ? body.adapterType : null;
    const model = typeof body.model === "string" ? body.model : null;
    const inputPrice = Number(body.inputPricePerMillionCents ?? 0);
    const outputPrice = Number(body.outputPricePerMillionCents ?? 0);
    const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : undefined;
    const active = body.active === undefined ? true : Boolean(body.active);

    if (!Number.isFinite(inputPrice) || inputPrice < 0 || !Number.isFinite(outputPrice) || outputPrice < 0) {
      res.status(400).json({ error: "invalid price values" });
      return;
    }

    const created = await pricing.create(companyId, {
      adapterType,
      model,
      inputPricePerMillionCents: Math.round(inputPrice),
      outputPricePerMillionCents: Math.round(outputPrice),
      effectiveFrom,
      active,
    });

    // optional retroactive recalculation
    const applyRetro = Boolean(body.applyRetroactive);
    const forceAll = Boolean(body.forceAll);
    if (applyRetro) {
      await pricing.recalculateCompanyCosts(companyId, { forceAll });
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "pricing.created",
      entityType: "token_pricing",
      entityId: created.id,
      details: { adapterType: created.adapterType, model: created.model, inputPrice: created.inputPricePerMillionCents, outputPrice: created.outputPricePerMillionCents, appliedRetro: applyRetro },
    });

    res.status(201).json(created);
  });

  return router;
}
