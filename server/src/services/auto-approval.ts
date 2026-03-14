/**
 * Auto-approval service for Paperclip
 * 
 * Automatically approves certain types of requests based on:
 * - Request type (e.g. make_request for API calls)
 * - Target URL (e.g. Paperclip's own API endpoints)
 * - Agent credentials (must be authenticated as an agent from the same company)
 */

type AutoApprovalAgent = {
  id: string;
  companyId: string;
};

export interface AutoApprovalConfig {
  enableAutoApprovalForInternalApi: boolean;
  internalApiUrlPatterns: string[];
  autoApprovableTypes: Set<string>;
}

export function defaultAutoApprovalConfig(): AutoApprovalConfig {
  const apiUrl = process.env.PAPERCLIP_API_URL || "";
  
  const customWhitelistStr = process.env.PAPERCLIP_AUTO_APPROVE_URL_WHITELIST || "";
  const customWhitelist = customWhitelistStr
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  const internalApiUrlPatterns = [
    "http://localhost:",
    "http://127.0.0.1:",
    "http://[::]:", // IPv6 localhost
    apiUrl,
    ...customWhitelist,
  ].filter(Boolean);

  return {
    enableAutoApprovalForInternalApi: process.env.PAPERCLIP_AUTO_APPROVE_INTERNAL_API !== "false",
    internalApiUrlPatterns,
    autoApprovableTypes: new Set([
      "make_request",
      "http_request",
      "fetch_request",
      "api_call",
    ]),
  };
}

export interface ApprovalRequest {
  type: string;
  payload: Record<string, unknown>;
  requestedByAgentId?: string | null;
}

export interface ApprovalCheckContext {
  agent?: AutoApprovalAgent | null;
  companyId: string;
  isAuthenticated: boolean;
}

/**
 * Determines if an approval should be auto-approved
 * 
 * Returns:
 * - `{ autoApprove: true, reason: string }` if approval should be auto-approved
 * - `{ autoApprove: false }` if approval requires human review
 */
export function shouldAutoApproveRequest(
  request: ApprovalRequest,
  context: ApprovalCheckContext,
  config: AutoApprovalConfig,
): { autoApprove: boolean; reason?: string } {
  // Only consider auto-approval for API/HTTP requests
  if (!config.autoApprovableTypes.has(request.type)) {
    return { autoApprove: false };
  }

  // Must have authenticated agent from same company
  if (!context.isAuthenticated || !context.agent || context.agent.companyId !== context.companyId) {
    return { autoApprove: false };
  }

  // Check if target URL matches internal API patterns
  const targetUrl = getTargetUrlFromPayload(request.payload);
  if (!targetUrl) {
    return { autoApprove: false };
  }

  if (!config.enableAutoApprovalForInternalApi) {
    return { autoApprove: false };
  }

  // Check if URL matches any internal API pattern
  const isInternalUrl = config.internalApiUrlPatterns.some((pattern) => {
    if (!pattern) return false;
    return targetUrl.startsWith(pattern);
  });

  if (isInternalUrl) {
    return {
      autoApprove: true,
      reason: `Auto-approved internal API request to ${targetUrl} from agent ${context.agent.id}`,
    };
  }

  return { autoApprove: false };
}

function getTargetUrlFromPayload(payload: Record<string, unknown>): string | null {
  // Handle different payload structures that agents might use
  const url =
    (typeof payload.url === "string" ? payload.url : null) ||
    (typeof payload.targetUrl === "string" ? payload.targetUrl : null) ||
    (typeof payload.endpoint === "string" ? payload.endpoint : null) ||
    (typeof payload.uri === "string" ? payload.uri : null) ||
    (typeof payload.address === "string" ? payload.address : null);

  return url ?? null;
}

/**
 * Extracts the approval decision from an auto-approval check
 */
export function getAutoApprovalDecision(
  request: ApprovalRequest,
  context: ApprovalCheckContext,
  config: AutoApprovalConfig,
): {
  shouldAutoApprove: boolean;
  decision?: "approved" | "pending";
  decidedByUserId?: string;
  decisionNote?: string;
} {
  const check = shouldAutoApproveRequest(request, context, config);

  if (!check.autoApprove) {
    return { shouldAutoApprove: false, decision: "pending" };
  }

  return {
    shouldAutoApprove: true,
    decision: "approved",
    decidedByUserId: "system:auto-approval",
    decisionNote: check.reason,
  };
}
