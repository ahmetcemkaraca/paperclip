import type { CompanyStatus } from "../constants.js";
import type { FallbackConfig } from "./fallback.js";

export interface Company {
  id: string;
  name: string;
  description: string | null;
  status: CompanyStatus;
  issuePrefix: string;
  issueCounter: number;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  requireBoardApprovalForNewAgents: boolean;
  maxConcurrentAgents: number;
  brandColor: string | null;
  systemPromptMd?: string;
  systemPromptUpdatedAt?: Date;
  fallbackConfig: FallbackConfig;
  createdAt: Date;
  updatedAt: Date;
}
