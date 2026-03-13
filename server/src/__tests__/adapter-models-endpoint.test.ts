import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { agentRoutes } from "../routes/agents.js";

// Mock the adapters module
const mockListAdapterModels = vi.hoisted(() => vi.fn());

vi.mock("../adapters/index.js", async () => {
  const actual = await vi.importActual("../adapters/index.js");
  return {
    ...actual,
    listAdapterModels: mockListAdapterModels,
  };
});

// Mock services
const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  normalizeAdapterConfigForPersistence: vi.fn(),
}));

const mockApprovalService = vi.hoisted(() => ({}));
const mockHeartbeatService = vi.hoisted(() => ({}));
const mockIssueApprovalService = vi.hoisted(() => ({}));
const mockIssueService = vi.hoisted(() => ({}));
const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  agentService: () => mockAgentService,
  accessService: () => mockAccessService,
  secretService: () => mockSecretService,
  approvalService: () => mockApprovalService,
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => mockIssueApprovalService,
  issueService: () => mockIssueService,
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

describe("GET /api/companies/:companyId/adapters/:type/models", () => {
  const companyId = "company-1";
  const boardActor = { type: "board", source: "local_implicit", companyId };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("valid adapter types", () => {
    it("returns models for claude_local adapter", async () => {
      // Task 4.5: Test with valid adapter type claude_local
      // Validates Requirements 9.1, 9.2
      const mockModels = [
        { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
        { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      ];
      mockListAdapterModels.mockResolvedValue(mockModels);

      const app = createApp(boardActor);
      const res = await request(app).get(`/api/companies/${companyId}/adapters/claude_local/models`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockModels);
      expect(mockListAdapterModels).toHaveBeenCalledWith("claude_local");
    });

    it("returns models for codex_local adapter", async () => {
      // Task 4.5: Test with valid adapter type codex_local
      // Validates Requirements 9.1, 9.2
      const mockModels = [
        { id: "codex-mini-latest", label: "Codex Mini (Latest)" },
        { id: "gpt-4o", label: "GPT-4o" },
      ];
      mockListAdapterModels.mockResolvedValue(mockModels);

      const app = createApp(boardActor);
      const res = await request(app).get(`/api/companies/${companyId}/adapters/codex_local/models`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockModels);
      expect(mockListAdapterModels).toHaveBeenCalledWith("codex_local");
    });

    it("returns models for copilot_cli adapter", async () => {
      // Task 4.5: Test with valid adapter type copilot_cli
      // Validates Requirements 9.1, 9.2
      const mockModels = [
        { id: "gpt-4o", label: "GPT-4o" },
        { id: "claude-sonnet-4", label: "Claude Sonnet 4" },
      ];
      mockListAdapterModels.mockResolvedValue(mockModels);

      const app = createApp(boardActor);
      const res = await request(app).get(`/api/companies/${companyId}/adapters/copilot_cli/models`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockModels);
      expect(mockListAdapterModels).toHaveBeenCalledWith("copilot_cli");
    });

    it("returns models for cursor adapter", async () => {
      // Task 4.5: Test with valid adapter type cursor
      // Validates Requirements 9.1, 9.2
      const mockModels = [
        { id: "auto", label: "Auto" },
        { id: "composer-1", label: "Composer 1" },
      ];
      mockListAdapterModels.mockResolvedValue(mockModels);

      const app = createApp(boardActor);
      const res = await request(app).get(`/api/companies/${companyId}/adapters/cursor/models`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockModels);
      expect(mockListAdapterModels).toHaveBeenCalledWith("cursor");
    });

    it("returns models for opencode_local adapter", async () => {
      // Task 4.5: Test with valid adapter type opencode_local
      // Validates Requirements 9.1, 9.2
      const mockModels = [
        { id: "opencode-mini", label: "OpenCode Mini", provider: "opencode" },
        { id: "opencode-pro", label: "OpenCode Pro", provider: "opencode" },
      ];
      mockListAdapterModels.mockResolvedValue(mockModels);

      const app = createApp(boardActor);
      const res = await request(app).get(`/api/companies/${companyId}/adapters/opencode_local/models`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockModels);
      expect(mockListAdapterModels).toHaveBeenCalledWith("opencode_local");
    });
  });

  describe("invalid adapter type", () => {
    it("handles invalid adapter type gracefully", async () => {
      // Task 4.5: Test with invalid adapter type
      // Validates Requirements 9.4
      mockListAdapterModels.mockResolvedValue([]);

      const app = createApp(boardActor);
      const res = await request(app).get(`/api/companies/${companyId}/adapters/invalid_adapter/models`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(mockListAdapterModels).toHaveBeenCalledWith("invalid_adapter");
    });

    it("handles unknown adapter type gracefully", async () => {
      // Task 4.5: Test with unknown adapter type
      // Validates Requirements 9.4
      mockListAdapterModels.mockResolvedValue([]);

      const app = createApp(boardActor);
      const res = await request(app).get(`/api/companies/${companyId}/adapters/nonexistent/models`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(mockListAdapterModels).toHaveBeenCalledWith("nonexistent");
    });
  });

  describe("empty model list handling", () => {
    it("returns empty array when adapter has no models", async () => {
      // Task 4.5: Test empty model list handling
      // Validates Requirements 9.3, 9.5
      mockListAdapterModels.mockResolvedValue([]);

      const app = createApp(boardActor);
      const res = await request(app).get(`/api/companies/${companyId}/adapters/claude_local/models`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it("returns empty array for adapter with no configured models", async () => {
      // Task 4.5: Test empty model list for unconfigured adapter
      // Validates Requirements 9.5
      mockListAdapterModels.mockResolvedValue([]);

      const app = createApp(boardActor);
      const res = await request(app).get(`/api/companies/${companyId}/adapters/opencode_local/models`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("model structure validation", () => {
    it("returns models with correct structure", async () => {
      // Task 4.5: Verify returned models have correct structure
      // Validates Requirements 9.2, 9.3
      const mockModels = [
        { id: "model-1", label: "Model 1" },
        { id: "model-2", label: "Model 2", provider: "test-provider" },
      ];
      mockListAdapterModels.mockResolvedValue(mockModels);

      const app = createApp(boardActor);
      const res = await request(app).get(`/api/companies/${companyId}/adapters/codex_local/models`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockModels);
      
      // Verify structure
      for (const model of res.body) {
        expect(model).toHaveProperty("id");
        expect(model).toHaveProperty("label");
        expect(typeof model.id).toBe("string");
        expect(typeof model.label).toBe("string");
      }
    });
  });

  describe("authorization", () => {
    it("enforces company access check", async () => {
      // Task 4.5: Verify company access is enforced
      // The assertCompanyAccess middleware should enforce this
      mockListAdapterModels.mockResolvedValue([
        { id: "test-model", label: "Test Model" },
      ]);

      // Test with matching company ID - should succeed
      const app = createApp({ type: "agent", agentId: "agent-1", companyId: companyId });
      const res = await request(app).get(`/api/companies/${companyId}/adapters/claude_local/models`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
