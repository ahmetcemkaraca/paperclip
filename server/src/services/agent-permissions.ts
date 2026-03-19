export type NormalizedAgentPermissions = Record<string, unknown> & {
  canCreateAgents: boolean;
  canInvokeOtherAgents: boolean;
};

export function defaultPermissionsForRole(role: string): NormalizedAgentPermissions {
  return {
    canCreateAgents: role === "ceo",
    canInvokeOtherAgents: role === "ceo",
  };
}

export function normalizeAgentPermissions(
  permissions: unknown,
  role: string,
): NormalizedAgentPermissions {
  const defaults = defaultPermissionsForRole(role);
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
    return defaults;
  }

  const record = permissions as Record<string, unknown>;
  return {
    ...record,
    canCreateAgents:
      typeof record.canCreateAgents === "boolean"
        ? record.canCreateAgents
        : defaults.canCreateAgents,
    canInvokeOtherAgents:
      typeof record.canInvokeOtherAgents === "boolean"
        ? record.canInvokeOtherAgents
        : defaults.canInvokeOtherAgents,
  };
}
