import type { CompanyStatus } from "../constants.js";

export interface FallbackConfig {
  enabled?: boolean;
  adapterId?: string;
  adapterType?: string;
  modelId?: string;
  rateLimitKeywords?: string[];
}

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
