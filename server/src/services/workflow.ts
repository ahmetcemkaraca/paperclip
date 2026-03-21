import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { workflows, workflowRuns, workflowRunSteps } from "@paperclipai/db";
import { notFound, badRequest } from "../errors.js";
import type {
  Workflow,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowStatus,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  WorkflowTriggerConfig,
  WorkflowNode,
  WorkflowEdge,
} from "@paperclipai/shared";

const VALID_WORKFLOW_STATUSES: WorkflowStatus[] = ["draft", "active", "paused", "archived"];
const VALID_TRIGGER_KINDS = ["schedule", "webhook", "event", "manual"];

function validateTriggerConfig(config: WorkflowTriggerConfig): void {
  if (!VALID_TRIGGER_KINDS.includes(config.kind)) {
    throw badRequest(`Invalid trigger kind: ${config.kind}`);
  }
  if (config.kind === "schedule" && !config.config.cronExpression) {
    throw badRequest("Schedule trigger requires cronExpression");
  }
  if (config.kind === "event" && !config.config.eventType) {
    throw badRequest("Event trigger requires eventType");
  }
}

function validateNodes(nodes: WorkflowNode[]): void {
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (!node.id) {
      throw badRequest("Each node must have an id");
    }
    if (nodeIds.has(node.id)) {
      throw badRequest(`Duplicate node id: ${node.id}`);
    }
    nodeIds.add(node.id);
    if (!node.type) {
      throw badRequest(`Node ${node.id} must have a type`);
    }
  }
}

function validateEdges(edges: WorkflowEdge[], nodeIds: Set<string>): void {
  for (const edge of edges) {
    if (!edge.id) {
      throw badRequest("Each edge must have an id");
    }
    if (!nodeIds.has(edge.sourceNodeId)) {
      throw badRequest(`Edge ${edge.id} references unknown source node: ${edge.sourceNodeId}`);
    }
    if (!nodeIds.has(edge.targetNodeId)) {
      throw badRequest(`Edge ${edge.id} references unknown target node: ${edge.targetNodeId}`);
    }
  }
}

function mapWorkflow(row: unknown): Workflow {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    companyId: r.companyId as string,
    name: r.name as string,
    description: r.description as string | null,
    status: r.status as WorkflowStatus,
    triggerConfig: r.triggerConfig as WorkflowTriggerConfig,
    nodes: r.nodes as WorkflowNode[],
    edges: r.edges as WorkflowEdge[],
    variables: r.variables as Record<string, unknown> | null,
    executionOrder: r.executionOrder as number,
    isTemplate: r.isTemplate as boolean,
    createdAt: new Date(r.createdAt as string).toISOString(),
    updatedAt: new Date(r.updatedAt as string).toISOString(),
  };
}

function mapWorkflowRun(row: unknown): WorkflowRun {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    workflowId: r.workflowId as string,
    companyId: r.companyId as string,
    status: r.status as WorkflowRun["status"],
    currentNodeId: r.currentNodeId as string | null,
    context: r.context as Record<string, unknown> | null,
    startedAt: r.startedAt ? new Date(r.startedAt as string).toISOString() : null,
    completedAt: r.completedAt ? new Date(r.completedAt as string).toISOString() : null,
    error: r.error as string | null,
    createdAt: new Date(r.createdAt as string).toISOString(),
    updatedAt: new Date(r.updatedAt as string).toISOString(),
  };
}

function mapWorkflowRunStep(row: unknown): WorkflowRunStep {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    runId: r.runId as string,
    nodeId: r.nodeId as string,
    nodeType: r.nodeType as string,
    status: r.status as WorkflowRunStep["status"],
    input: r.input as Record<string, unknown> | null,
    output: r.output as Record<string, unknown> | null,
    error: r.error as string | null,
    startedAt: r.startedAt ? new Date(r.startedAt as string).toISOString() : null,
    completedAt: r.completedAt ? new Date(r.completedAt as string).toISOString() : null,
    createdAt: new Date(r.createdAt as string).toISOString(),
  };
}

export function workflowService(db: Db) {
  return {
    createWorkflow: async (companyId: string, data: CreateWorkflowRequest): Promise<Workflow> => {
      validateTriggerConfig(data.triggerConfig);
      validateNodes(data.nodes);
      validateEdges(data.edges, new Set(data.nodes.map(n => n.id)));

      const [workflow] = await db
        .insert(workflows)
        .values({
          companyId,
          name: data.name,
          description: data.description ?? null,
          status: "draft",
          triggerConfig: data.triggerConfig,
          nodes: data.nodes,
          edges: data.edges,
          variables: data.variables ?? null,
          isTemplate: data.isTemplate ?? false,
        })
        .returning();

      return mapWorkflow(workflow);
    },

    getWorkflow: async (companyId: string, id: string): Promise<Workflow | null> => {
      const rows = await db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, id), eq(workflows.companyId, companyId)));

      if (rows.length === 0) return null;
      return mapWorkflow(rows[0]);
    },

    listWorkflows: async (
      companyId: string,
      filters?: { status?: WorkflowStatus; isTemplate?: boolean }
    ): Promise<Workflow[]> => {
      const conditions = [eq(workflows.companyId, companyId)];

      if (filters?.status) {
        conditions.push(eq(workflows.status, filters.status));
      }
      if (filters?.isTemplate !== undefined) {
        conditions.push(eq(workflows.isTemplate, filters.isTemplate));
      }

      const rows = await db
        .select()
        .from(workflows)
        .where(and(...conditions))
        .orderBy(desc(workflows.createdAt));

      return rows.map(mapWorkflow);
    },

    updateWorkflow: async (
      companyId: string,
      id: string,
      data: UpdateWorkflowRequest
    ): Promise<Workflow> => {
      const [existing] = await db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, id), eq(workflows.companyId, companyId)));

      if (!existing) {
        throw notFound("Workflow not found");
      }

      if (data.triggerConfig) {
        validateTriggerConfig(data.triggerConfig);
      }
      if (data.nodes) {
        validateNodes(data.nodes);
        const nodeIds = new Set(data.nodes.map(n => n.id));
        if (data.edges) {
          validateEdges(data.edges, nodeIds);
        } else {
          validateEdges(existing.edges as WorkflowEdge[], nodeIds);
        }
      } else if (data.edges) {
        validateEdges(data.edges, new Set((existing.nodes as WorkflowNode[]).map(n => n.id)));
      }

      const [updated] = await db
        .update(workflows)
        .set({
          name: data.name ?? existing.name,
          description: data.description ?? existing.description,
          status: data.status ?? existing.status,
          triggerConfig: data.triggerConfig ?? existing.triggerConfig,
          nodes: data.nodes ?? existing.nodes,
          edges: data.edges ?? existing.edges,
          variables: data.variables ?? existing.variables,
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, id))
        .returning();

      return mapWorkflow(updated);
    },

    deleteWorkflow: async (companyId: string, id: string): Promise<void> => {
      const [existing] = await db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, id), eq(workflows.companyId, companyId)));

      if (!existing) {
        throw notFound("Workflow not found");
      }

      await db.delete(workflows).where(eq(workflows.id, id));
    },

    createRun: async (companyId: string, workflowId: string): Promise<WorkflowRun> => {
      const [workflow] = await db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, workflowId), eq(workflows.companyId, companyId)));

      if (!workflow) {
        throw notFound("Workflow not found");
      }

      if (workflow.status !== "active") {
        throw badRequest("Workflow must be active to run");
      }

      const [run] = await db
        .insert(workflowRuns)
        .values({
          workflowId,
          companyId,
          status: "pending",
        })
        .returning();

      return mapWorkflowRun(run);
    },

    getRun: async (companyId: string, id: string): Promise<WorkflowRun | null> => {
      const rows = await db
        .select()
        .from(workflowRuns)
        .where(and(eq(workflowRuns.id, id), eq(workflowRuns.companyId, companyId)));

      if (rows.length === 0) return null;
      return mapWorkflowRun(rows[0]);
    },

    listRuns: async (
      companyId: string,
      workflowId?: string
    ): Promise<WorkflowRun[]> => {
      const conditions = [eq(workflowRuns.companyId, companyId)];

      if (workflowId) {
        conditions.push(eq(workflowRuns.workflowId, workflowId));
      }

      const rows = await db
        .select()
        .from(workflowRuns)
        .where(and(...conditions))
        .orderBy(desc(workflowRuns.createdAt));

      return rows.map(mapWorkflowRun);
    },

    getRunSteps: async (companyId: string, runId: string): Promise<WorkflowRunStep[]> => {
      const [run] = await db
        .select()
        .from(workflowRuns)
        .where(and(eq(workflowRuns.id, runId), eq(workflowRuns.companyId, companyId)));

      if (!run) {
        throw notFound("Run not found");
      }

      const rows = await db
        .select()
        .from(workflowRunSteps)
        .where(eq(workflowRunSteps.runId, runId));

      return rows.map(mapWorkflowRunStep);
    },
  };
}