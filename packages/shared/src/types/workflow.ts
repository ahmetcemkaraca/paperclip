export type WorkflowStatus = "draft" | "active" | "paused" | "archived";
export type WorkflowRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type WorkflowRunStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface WorkflowTriggerConfig {
  kind: "schedule" | "webhook" | "event" | "manual";
  config: {
    cronExpression?: string;
    timezone?: string;
    eventType?: string;
    eventFilter?: Record<string, unknown>;
  };
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePort?: string;
  condition?: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  triggerConfig: WorkflowTriggerConfig;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, unknown> | null;
  executionOrder: number;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  companyId: string;
  status: WorkflowRunStatus;
  currentNodeId: string | null;
  context: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRunStep {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  status: WorkflowRunStepStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  triggerConfig: WorkflowTriggerConfig;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: Record<string, unknown>;
  isTemplate?: boolean;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  status?: WorkflowStatus;
  triggerConfig?: WorkflowTriggerConfig;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  variables?: Record<string, unknown>;
}