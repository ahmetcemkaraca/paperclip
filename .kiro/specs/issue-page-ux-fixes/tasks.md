# Implementation Plan: Issue Page UX Fixes

## Overview

Implement issue-page usability improvements in three tracks:

1. collapse issue documents by default
2. add a company-level issue comment order setting
3. make agent mention parsing resilient to `@ceo` and hyphen/space alias drift

## Tasks

- [ ] 1. Add a new issue-page UX spec scaffold in `.kiro/specs/issue-page-ux-fixes/`
  - [x] Create `requirements.md`
  - [x] Create `design.md`
  - [x] Create `tasks.md`
  - [x] Create `.config.kiro`
  - _Purpose: keep this work tracked in the same Kiro-style workflow as other feature specs_

- [ ] 2. Make issue documents collapsed by default
  - Update `ui/src/components/IssueDocumentsSection.tsx` to initialize folded state as collapsed when no saved state exists
  - Preserve existing per-issue local storage behavior
  - Keep hash anchor behavior working by auto-expanding the targeted document after scroll
  - Add a regression test for first-load collapsed state

- [ ] 3. Add a company setting for issue comment order
  - Extend `packages/db/src/schema/companies.ts` with a company-scoped comment-order field
  - Sync the new field into `packages/shared/src/types/company.ts` and `packages/shared/src/validators/company.ts`
  - Update `server/src/routes/companies.ts` and `server/src/services/companies.ts` to read/write it
  - Expose the setting in `ui/src/pages/CompanySettings.tsx`
  - Pass the value into `ui/src/pages/IssueDetail.tsx` / `ui/src/components/CommentThread.tsx`
  - Sort newest-first or newest-last based on the setting

- [ ] 4. Add mention alias normalization for agents
  - Introduce a shared canonicalization helper for agent mentions
  - Update `ui/src/components/MarkdownEditor.tsx` and the issue mention option generation path so autocomplete can surface agents by display name and safe aliases
  - Update `server/src/services/issues.ts` mention extraction so notifications resolve `@ceo`, `@xyz-xyz`, and `@xyz xyz` to the same agent where appropriate
  - Keep company scoping and duplicate-notification dedupe intact

- [ ] 5. Add focused tests
  - Add tests for collapsed document defaults
  - Add tests for company comment order persistence and rendering
  - Add tests for mention normalization and notification routing
  - Cover both UI suggestion behavior and server resolution where practical

- [ ] 6. Verify the feature end-to-end
  - Run targeted tests for issue page behavior
  - Run typecheck/build if the repo baseline allows it
  - Confirm no regression in issue comment, document, or mention flows
