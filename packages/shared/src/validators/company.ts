import { z } from "zod";
import { COMPANY_STATUSES } from "../constants.js";

const logoAssetIdSchema = z.string().uuid().nullable().optional();

export const createCompanySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  budgetMonthlyCents: z.number().int().nonnegative().optional().default(0),
});

export type CreateCompany = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = createCompanySchema
  .partial()
  .extend({
    status: z.enum(COMPANY_STATUSES).optional(),
    spentMonthlyCents: z.number().int().nonnegative().optional(),
    requireBoardApprovalForNewAgents: z.boolean().optional(),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    logoAssetId: logoAssetIdSchema,
  });

export type UpdateCompany = z.infer<typeof updateCompanySchema>;

export const updateCompanySystemPromptSchema = z.object({
  content: z.string().min(1).max(120_000),
});

export type UpdateCompanySystemPrompt = z.infer<typeof updateCompanySystemPromptSchema>;

export const proposeCompanySystemPromptSchema = z.object({
  content: z.string().min(1).max(120_000),
  note: z.string().max(4000).optional().nullable(),
});

export type ProposeCompanySystemPrompt = z.infer<typeof proposeCompanySystemPromptSchema>;
