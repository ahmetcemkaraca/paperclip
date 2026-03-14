import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentRoutes } from "../routes/agents.js";

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
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
const mockIssueService = vi.hoisted(() => ({
  list: vi.fn(),
}));
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

describe("GET /api/agents/me/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentNotificationService.listMentions.mockResolvedValue({ items: [], nextCursor: null });
    mockAgentService.update.mockResolvedValue({
      id: "agent-1",
      lastNotificationsReadAt: new Date("2026-03-14T09:00:00.000Z"),
    });
  });

  it("requires agent authentication", async () => {
    const app = createApp({ type: "board", source: "local_implicit", companyId: "company-1" });
    const res = await request(app).get("/api/agents/me/notifications");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Agent authentication required" });
  });

  it("returns mention notifications for authenticated agent", async () => {
    mockAgentNotificationService.listMentions.mockResolvedValue({
      items: [
        {
          id: "cmt-1",
          type: "issue_comment",
          companyId: "company-1",
          createdAt: new Date("2026-03-14T08:10:00.000Z"),
          excerpt: "@BackendEngineer can you review this?",
          issueId: "issue-1",
        },
      ],
      nextCursor: "next-cursor-token",
    });

    const app = createApp({ type: "agent", agentId: "agent-1", companyId: "company-1" });
    const res = await request(app).get("/api/agents/me/notifications?limit=25");

    expect(res.status).toBe(200);
    expect(mockAgentNotificationService.listMentions).toHaveBeenCalledWith({
      companyId: "company-1",
      agentId: "agent-1",
      limit: 25,
      sources: undefined,
      since: null,
      unreadOnly: false,
      cursor: undefined,
    });
    expect(res.headers["x-next-cursor"]).toBe("next-cursor-token");
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: "cmt-1", type: "issue_comment", issueId: "issue-1" });
  });

  it("parses sources/since/unreadOnly/cursor query params", async () => {
    const app = createApp({ type: "agent", agentId: "agent-1", companyId: "company-1" });
    const res = await request(app)
      .get(
        "/api/agents/me/notifications?limit=10&sources=issue,discussion,invalid&since=2026-03-14T08:00:00.000Z&unreadOnly=true&cursor=abc123",
      );

    expect(res.status).toBe(200);
    expect(mockAgentNotificationService.listMentions).toHaveBeenCalledWith({
      companyId: "company-1",
      agentId: "agent-1",
      limit: 10,
      sources: ["issue", "discussion"],
      since: new Date("2026-03-14T08:00:00.000Z"),
      unreadOnly: true,
      cursor: "abc123",
    });
  });

  it("returns 422 for invalid since param", async () => {
    const app = createApp({ type: "agent", agentId: "agent-1", companyId: "company-1" });
    const res = await request(app).get("/api/agents/me/notifications?since=not-a-date");

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: "Invalid since query param. Use ISO-8601 date-time." });
  });

  it("marks notifications read using explicit readAt", async () => {
    const app = createApp({ type: "agent", agentId: "agent-1", companyId: "company-1" });
    const res = await request(app)
      .post("/api/agents/me/notifications/read")
      .send({ readAt: "2026-03-14T09:00:00.000Z" });

    expect(res.status).toBe(200);
    expect(mockAgentService.update).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({ lastNotificationsReadAt: new Date("2026-03-14T09:00:00.000Z") }),
    );
    expect(res.body).toMatchObject({ agentId: "agent-1" });
  });

  it("marks notifications read using cursor", async () => {
    const cursor = Buffer.from(
      JSON.stringify({ createdAtIso: "2026-03-14T08:30:00.000Z", id: "cmt-2" }),
      "utf8",
    ).toString("base64url");
    const app = createApp({ type: "agent", agentId: "agent-1", companyId: "company-1" });
    const res = await request(app)
      .post("/api/agents/me/notifications/read")
      .send({ cursor });

    expect(res.status).toBe(200);
    expect(mockAgentService.update).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({ lastNotificationsReadAt: new Date("2026-03-14T08:30:00.000Z") }),
    );
  });

  it("returns 422 for invalid read cursor", async () => {
    const app = createApp({ type: "agent", agentId: "agent-1", companyId: "company-1" });
    const res = await request(app)
      .post("/api/agents/me/notifications/read")
      .send({ cursor: "not-base64" });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: "Invalid cursor." });
  });
});
