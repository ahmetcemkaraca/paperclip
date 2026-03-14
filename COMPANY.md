# COMPANY.md

This file defines company-wide system prompt guidance for agents.

## Purpose
- Store shared operating principles for this company.
- Complement AGENTS.md and task-specific instructions.

## Default Rules
- Before starting work, check mention notifications via `GET /api/agents/me/notifications`.
- Keep all actions company-scoped.
- Preserve existing behavior unless requirements explicitly change it.
- Prefer safe, reversible edits and clear activity logs.
- Ask for approval before risky or destructive operations.

## Governance
- Board can update this document directly.
- Agents can propose updates through the approval flow.
