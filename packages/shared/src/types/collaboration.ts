export type CollaborationKind = "delegation" | "assistance" | "review" | "pair_programming";
export type CollaborationStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";
export type ReviewType = "code_review" | "output_review" | "process_review";
export type ReviewStatus = "requested" | "in_progress" | "approved" | "changes_requested" | "cancelled";

export interface AgentCollaboration {
  id: string;
  companyId: string;
  initiatorAgentId: string;
  collaboratorAgentId: string;
  issueId: string | null;
  kind: CollaborationKind;
  status: CollaborationStatus;
  requestMessage: string;
  responseMessage: string | null;
  dueBy: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCollaborationDetail extends AgentCollaboration {
  initiatorAgent: {
    id: string;
    name: string;
    role: string;
  };
  collaboratorAgent: {
    id: string;
    name: string;
    role: string;
  };
  issue: {
    id: string;
    title: string;
    status: string;
  } | null;
}

export interface AgentReview {
  id: string;
  companyId: string;
  reviewerAgentId: string;
  revieweeAgentId: string;
  issueId: string | null;
  reviewType: ReviewType;
  status: ReviewStatus;
  feedback: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentReviewDetail extends AgentReview {
  reviewerAgent: {
    id: string;
    name: string;
    role: string;
  };
  revieweeAgent: {
    id: string;
    name: string;
    role: string;
  };
  issue: {
    id: string;
    title: string;
    status: string;
  } | null;
}

export interface CreateCollaborationRequest {
  collaboratorAgentId: string;
  issueId?: string;
  kind: CollaborationKind;
  requestMessage: string;
  dueBy?: string;
}

export interface RespondToCollaborationRequest {
  status: "accepted" | "declined";
  responseMessage?: string;
}

export interface CreateReviewRequest {
  reviewerAgentId: string;
  issueId?: string;
  reviewType: ReviewType;
}

export interface CompleteReviewRequest {
  status: "approved" | "changes_requested";
  feedback?: string;
}