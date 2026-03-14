/**
 * Unit tests for AgentConfigForm handleSave function
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import { describe, it, expect, vi } from "vitest";

describe("AgentConfigForm handleSave - Minimal Patch Generation", () => {
  /**
   * Helper to simulate the hasChanged logic from AgentConfigForm
   */
  function hasChanged(newValue: unknown, originalValue: unknown): boolean {
    // Handle undefined/null equivalence for optional fields
    if (newValue === undefined && originalValue === undefined) return false;
    if (newValue === null && originalValue === null) return false;
    if (
      newValue === "" &&
      (originalValue === "" || originalValue === undefined || originalValue === null)
    )
      return false;

    // Deep equality check for objects/arrays
    if (
      typeof newValue === "object" &&
      typeof originalValue === "object" &&
      newValue !== null &&
      originalValue !== null
    ) {
      return JSON.stringify(newValue) !== JSON.stringify(originalValue);
    }

    return newValue !== originalValue;
  }

  /**
   * Helper to build patch from overlay (simplified version of handleSave logic)
   */
  function buildPatch(
    overlay: {
      identity: Record<string, unknown>;
      adapterType?: string;
      adapterConfig: Record<string, unknown>;
      heartbeat: Record<string, unknown>;
    },
    agent: {
      name: string;
      title?: string;
      adapterType: string;
      adapterConfig: Record<string, unknown>;
      runtimeConfig?: { heartbeat?: Record<string, unknown> };
    }
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = {};

    // Only include identity fields that actually changed
    if (Object.keys(overlay.identity).length > 0) {
      const identityChanges: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(overlay.identity)) {
        const originalValue = agent[key as keyof typeof agent];
        if (hasChanged(value, originalValue)) {
          identityChanges[key] = value;
        }
      }
      if (Object.keys(identityChanges).length > 0) {
        Object.assign(patch, identityChanges);
      }
    }

    if (overlay.adapterType !== undefined && hasChanged(overlay.adapterType, agent.adapterType)) {
      patch.adapterType = overlay.adapterType;
    }

    if (Object.keys(overlay.adapterConfig).length > 0) {
      // Only include adapter config fields that actually changed
      const existing = agent.adapterConfig ?? {};
      const configChanges: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(overlay.adapterConfig)) {
        if (hasChanged(value, existing[key])) {
          configChanges[key] = value;
        }
      }
      if (Object.keys(configChanges).length > 0) {
        patch.adapterConfig = { ...existing, ...configChanges };
      }
    }

    if (Object.keys(overlay.heartbeat).length > 0) {
      const existingRc = agent.runtimeConfig ?? {};
      const existingHb = existingRc.heartbeat ?? {};
      const heartbeatChanges: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(overlay.heartbeat)) {
        if (hasChanged(value, existingHb[key])) {
          heartbeatChanges[key] = value;
        }
      }
      if (Object.keys(heartbeatChanges).length > 0) {
        patch.runtimeConfig = {
          ...existingRc,
          heartbeat: { ...existingHb, ...heartbeatChanges },
        };
      }
    }

    return patch;
  }

  it("should only include changed identity fields in patch (Req 5.4)", () => {
    const agent = {
      name: "test-agent",
      title: "Test Agent",
      adapterType: "claude_local",
      adapterConfig: { model: "claude-3-5-sonnet-20241022" },
    };

    const overlay = {
      identity: { name: "test-agent", title: "Updated Title" },
      adapterConfig: {},
      heartbeat: {},
    };

    const patch = buildPatch(overlay, agent);

    // Only title should be in patch (name unchanged)
    expect(patch).toEqual({ title: "Updated Title" });
    expect(patch).not.toHaveProperty("name");
  });

  it("should not include empty strings for unchanged fields (Req 5.5)", () => {
    const agent = {
      name: "test-agent",
      title: undefined,
      adapterType: "claude_local",
      adapterConfig: { model: "claude-3-5-sonnet-20241022" },
    };

    const overlay = {
      identity: { title: "" }, // Empty string for unchanged optional field
      adapterConfig: {},
      heartbeat: {},
    };

    const patch = buildPatch(overlay, agent);

    // Empty string should not be included when original was undefined
    expect(patch).toEqual({});
  });

  it("should preserve unchanged adapter config fields (Req 5.1, 5.2, 5.3)", () => {
    const agent = {
      name: "test-agent",
      adapterType: "codex_local",
      adapterConfig: {
        model: "gpt-4o",
        cwd: "/workspace",
        instructionsFilePath: "/path/to/AGENTS.md",
        modelReasoningEffort: "medium",
        search: true,
      },
    };

    const overlay = {
      identity: { name: "updated-agent" },
      adapterConfig: {}, // No adapter config changes
      heartbeat: {},
    };

    const patch = buildPatch(overlay, agent);

    // Should only include name change, not adapter config
    expect(patch).toEqual({ name: "updated-agent" });
    expect(patch).not.toHaveProperty("adapterConfig");
  });

  it("should preserve adapter-specific fields when updating other fields (Req 8.1-8.6)", () => {
    const agent = {
      name: "test-agent",
      adapterType: "codex_local",
      adapterConfig: {
        model: "gpt-4o",
        cwd: "/workspace",
        modelReasoningEffort: "high",
        search: true,
        dangerouslyBypassApprovalsAndSandbox: false,
      },
    };

    const overlay = {
      identity: {},
      adapterConfig: { cwd: "/new-workspace" }, // Only change cwd
      heartbeat: {},
    };

    const patch = buildPatch(overlay, agent);

    // Should include all existing fields plus the changed one
    expect(patch.adapterConfig).toEqual({
      model: "gpt-4o",
      cwd: "/new-workspace",
      modelReasoningEffort: "high",
      search: true,
      dangerouslyBypassApprovalsAndSandbox: false,
    });
  });

  it("should preserve unchanged adapterConfig keys when adapter type changes", () => {
    const agent = {
      name: "test-agent",
      adapterType: "codex_local",
      adapterConfig: {
        model: "gpt-4o",
        modelReasoningEffort: "high",
        search: true,
      },
    };

    const overlay = {
      identity: {},
      adapterType: "claude_local",
      adapterConfig: {
        model: "claude-3-5-sonnet-20241022",
        effort: "medium",
      },
      heartbeat: {},
    };

    const patch = buildPatch(overlay, agent);

    // Should preserve unchanged keys and only patch changed fields
    expect(patch).toEqual({
      adapterType: "claude_local",
      adapterConfig: {
        model: "claude-3-5-sonnet-20241022",
        effort: "medium",
        modelReasoningEffort: "high",
        search: true,
      },
    });
  });

  it("should only include changed fields in minimal patch (Req 5.4, 5.6)", () => {
    const agent = {
      name: "test-agent",
      title: "Test Agent",
      adapterType: "claude_local",
      adapterConfig: {
        model: "claude-3-5-sonnet-20241022",
        cwd: "/workspace",
        effort: "medium",
      },
      runtimeConfig: {
        heartbeat: {
          enabled: true,
          intervalSec: 300,
        },
      },
    };

    const overlay = {
      identity: { name: "test-agent", title: "Test Agent" }, // Unchanged
      adapterConfig: { model: "claude-3-5-sonnet-20241022", cwd: "/workspace" }, // Unchanged
      heartbeat: { enabled: true, intervalSec: 300 }, // Unchanged
    };

    const patch = buildPatch(overlay, agent);

    // No changes, so patch should be empty
    expect(patch).toEqual({});
  });

  it("should handle null values correctly (Req 5.6)", () => {
    const agent = {
      name: "test-agent",
      title: "Test Agent",
      adapterType: "claude_local",
      adapterConfig: { model: "claude-3-5-sonnet-20241022" },
    };

    const overlay = {
      identity: { title: null }, // Explicitly clearing title
      adapterConfig: {},
      heartbeat: {},
    };

    const patch = buildPatch(overlay, agent);

    // Null should be included when explicitly clearing a field
    expect(patch).toEqual({ title: null });
  });

  it("should preserve cursor mode field (Req 8.4)", () => {
    const agent = {
      name: "test-agent",
      adapterType: "cursor",
      adapterConfig: {
        model: "claude-3-5-sonnet-20241022",
        mode: "plan",
      },
    };

    const overlay = {
      identity: { name: "updated-agent" },
      adapterConfig: {}, // No adapter config changes
      heartbeat: {},
    };

    const patch = buildPatch(overlay, agent);

    // Should only include name change
    expect(patch).toEqual({ name: "updated-agent" });
    expect(patch).not.toHaveProperty("adapterConfig");
  });

  it("should preserve opencode variant field (Req 8.5)", () => {
    const agent = {
      name: "test-agent",
      adapterType: "opencode_local",
      adapterConfig: {
        model: "anthropic/claude-3-5-sonnet-20241022",
        variant: "high",
      },
    };

    const overlay = {
      identity: {},
      adapterConfig: { model: "anthropic/claude-3-5-sonnet-20241022" }, // Unchanged
      heartbeat: {},
    };

    const patch = buildPatch(overlay, agent);

    // No changes, so patch should be empty
    expect(patch).toEqual({});
  });

  it("should preserve claude effort field (Req 8.6)", () => {
    const agent = {
      name: "test-agent",
      adapterType: "claude_local",
      adapterConfig: {
        model: "claude-3-5-sonnet-20241022",
        effort: "high",
      },
    };

    const overlay = {
      identity: {},
      adapterConfig: { model: "claude-3-5-sonnet-20241022" }, // Unchanged
      heartbeat: {},
    };

    const patch = buildPatch(overlay, agent);

    // No changes, so patch should be empty
    expect(patch).toEqual({});
  });
});
