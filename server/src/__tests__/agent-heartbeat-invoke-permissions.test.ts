import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentRoutes } from "../routes/agents.js";

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  updatePermissions: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  wakeup: vi.fn(),
  invoke: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  normalizeAdapterConfigForPersistence: vi.fn(),
  normalizeHireApprovalPayloadForPersistence: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
}));

const mockApprovalService = vi.hoisted(() => ({}));
const mockIssueApprovalService = vi.hoisted(() => ({}));
const mockIssueService = vi.hoisted(() => ({}));
const mockAgentNotificationService = vi.hoisted(() => ({
  listMentions: vi.fn(),
}));
const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  agentService: () => mockAgentService,
  heartbeatService: () => mockHeartbeatService,
  secretService: () => mockSecretService,
  accessService: () => mockAccessService,
  approvalService: () => mockApprovalService,
  issueApprovalService: () => mockIssueApprovalService,
  issueService: () => mockIssueService,
  agentNotificationService: () => mockAgentNotificationService,
  logActivity: mockLogActivity,
}));

function createApp(actor: any) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", agentRoutes({} as any));
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: String(err?.message ?? err ?? "unknown") });
  });
  return app;
}

describe("agent heartbeat invoke/wakeup permission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeartbeatService.wakeup.mockResolvedValue({ id: "run-1" });
    mockHeartbeatService.invoke.mockResolvedValue({ id: "run-2" });
    mockAgentService.updatePermissions.mockResolvedValue({
      id: "agent-1",
      companyId: "company-1",
      permissions: { canCreateAgents: false, canInvokeOtherAgents: false },
    });
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("rejects agent invoking another agent by default", async () => {
    const targetId = "11111111-1111-4111-8111-111111111111";
    const callerId = "22222222-2222-4222-8222-222222222222";
    mockAgentService.getById.mockImplementation(async (id: string) => {
      if (id === targetId) {
        return { id, companyId: "company-1", permissions: { canInvokeOtherAgents: false } };
      }
      if (id === callerId) {
        return { id, companyId: "company-1", permissions: { canInvokeOtherAgents: false } };
      }
      return null;
    });

    const app = createApp({ type: "agent", agentId: callerId, companyId: "company-1" });
    const res = await request(app).post(`/api/agents/${targetId}/wakeup`).send({});
    if (res.status !== 403) {
      throw new Error(`unexpected status=${res.status} body=${JSON.stringify(res.body)}`);
    }
  });

  it("allows agent invoking another agent when explicitly permitted", async () => {
    const targetId = "11111111-1111-4111-8111-111111111111";
    const callerId = "22222222-2222-4222-8222-222222222222";
    mockAgentService.getById.mockImplementation(async (id: string) => {
      if (id === targetId) {
        return { id, companyId: "company-1", permissions: { canInvokeOtherAgents: false } };
      }
      if (id === callerId) {
        return { id, companyId: "company-1", permissions: { canInvokeOtherAgents: true } };
      }
      return null;
    });

    const app = createApp({ type: "agent", agentId: callerId, companyId: "company-1" });
    const res = await request(app).post(`/api/agents/${targetId}/wakeup`).send({});
    if (res.status !== 202) {
      throw new Error(`unexpected status=${res.status} body=${JSON.stringify(res.body)}`);
    }
  });

  it("allows agent invoking another agent through heartbeat invoke when explicitly permitted", async () => {
    const targetId = "11111111-1111-4111-8111-111111111111";
    const callerId = "22222222-2222-4222-8222-222222222222";
    mockAgentService.getById.mockImplementation(async (id: string) => {
      if (id === targetId) {
        return { id, companyId: "company-1", permissions: { canInvokeOtherAgents: false } };
      }
      if (id === callerId) {
        return { id, companyId: "company-1", permissions: { canInvokeOtherAgents: true } };
      }
      return null;
    });

    const app = createApp({ type: "agent", agentId: callerId, companyId: "company-1" });
    const res = await request(app).post(`/api/agents/${targetId}/heartbeat/invoke`).send({});
    if (res.status !== 202) {
      throw new Error(`unexpected status=${res.status} body=${JSON.stringify(res.body)}`);
    }
  });

  it("allows an agent to toggle its own invoke-other-agents permission", async () => {
    const targetId = "11111111-1111-4111-8111-111111111111";
    mockAgentService.getById.mockImplementation(async (id: string) => {
      if (id === targetId) {
        return {
          id,
          companyId: "company-1",
          role: "general",
          permissions: { canCreateAgents: false, canInvokeOtherAgents: false },
        };
      }
      return null;
    });
    mockAgentService.updatePermissions.mockResolvedValue({
      id: targetId,
      companyId: "company-1",
      role: "general",
      permissions: { canCreateAgents: false, canInvokeOtherAgents: true },
    });

    const app = createApp({ type: "agent", agentId: targetId, companyId: "company-1" });
    const res = await request(app)
      .patch(`/api/agents/${targetId}/permissions`)
      .send({ canInvokeOtherAgents: true });
    if (res.status !== 200) {
      throw new Error(`unexpected status=${res.status} body=${JSON.stringify(res.body)}`);
    }
    expect(mockAgentService.updatePermissions).toHaveBeenCalledWith(targetId, {
      canInvokeOtherAgents: true,
    });
  });

  it("rejects a non-ceo agent from changing canCreateAgents", async () => {
    const targetId = "11111111-1111-4111-8111-111111111111";
    mockAgentService.getById.mockImplementation(async (id: string) => {
      if (id === targetId) {
        return {
          id,
          companyId: "company-1",
          role: "general",
          permissions: { canCreateAgents: false, canInvokeOtherAgents: false },
        };
      }
      return null;
    });

    const app = createApp({ type: "agent", agentId: targetId, companyId: "company-1" });
    const res = await request(app)
      .patch(`/api/agents/${targetId}/permissions`)
      .send({ canCreateAgents: true });
    if (res.status !== 403) {
      throw new Error(`unexpected status=${res.status} body=${JSON.stringify(res.body)}`);
    }
  });
});
