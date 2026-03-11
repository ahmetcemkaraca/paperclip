import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { pushSubscriptions } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { validate } from "../middleware/validate.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { z } from "zod";

const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
});

export function notificationRoutes(db: Db) {
  const router = Router();

  // POST /companies/:companyId/notifications/subscribe
  router.post(
    "/companies/:companyId/notifications/subscribe",
    validate(subscriptionSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const { subscription } = req.body;

      try {
        // Upsert: Update if exists, otherwise insert
        const existing = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
          .limit(1);

        if (existing.length > 0) {
          // Update existing subscription
          await db
            .update(pushSubscriptions)
            .set({
              companyId,
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth,
            })
            .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
        } else {
          // Insert new subscription
          await db.insert(pushSubscriptions).values({
            companyId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          });
        }

        res.json({
          success: true,
          message: "Subscription saved successfully",
        });
      } catch (error) {
        console.error("Failed to save subscription:", error);
        res.status(500).json({
          success: false,
          message: "Failed to save subscription",
        });
      }
    }
  );

  // DELETE /companies/:companyId/notifications/unsubscribe
  router.delete(
    "/companies/:companyId/notifications/unsubscribe",
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const { endpoint } = req.body;

      if (!endpoint || typeof endpoint !== "string") {
        res.status(400).json({
          success: false,
          message: "Endpoint is required",
        });
        return;
      }

      try {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, endpoint));

        res.json({
          success: true,
          message: "Unsubscribed successfully",
        });
      } catch (error) {
        console.error("Failed to unsubscribe:", error);
        res.status(500).json({
          success: false,
          message: "Failed to unsubscribe",
        });
      }
    }
  );

  return router;
}
