# Design Document: Issue Page UX Fixes

## Overview

This feature set improves the issue detail experience in three places:

- document folding defaults
- comment ordering preference
- mention canonicalization for agent tagging

The implementation should reuse existing issue/company/mention primitives where possible rather than introducing parallel logic.

## Architecture

### 1. Default-collapsed documents

`ui/src/components/IssueDocumentsSection.tsx` already persists folded document keys per issue in local storage. The new behavior should treat "no saved preference" as "collapsed by default" rather than "expanded by default".

Recommended shape:

- if a user has an existing saved fold state, keep it
- if there is no saved state, initialize the document list as folded
- keep hash navigation working by auto-expanding the target document after anchor scroll

This can stay entirely on the client.

### 2. Company comment order setting

The comment order preference should be a company-level setting because different teams may prefer different issue-reading patterns.

Recommended model:

- add a company field such as `issueCommentOrder`
- use a string enum: `newest_last` and `newest_first`
- default new companies to `newest_last` to preserve current behavior
- include the field in company shared types, validators, routes, and settings UI

The issue page should pass the selected company preference into the thread renderer, and the renderer should sort the timeline accordingly.

The sorting should apply to:

- issue comments
- linked run metadata shown alongside comments

### 3. Mention resolution and safe fallback

The current issue mention flow should be split into two layers:

1. UI mention suggestion and insertion
2. Server-side mention resolution for notifications and tagging

Both layers should share the same canonicalization rules so the visible mention and the notification target stay aligned.

Canonicalization guidance:

- lower-case everything
- collapse whitespace
- treat hyphens, underscores, and repeated separators as equivalent where safe
- compare against the agent display name, the agent URL key, and normalized aliases
- keep exact name matching as the first preference

The fallback should allow:

- `@ceo` to match the CEO agent alias/name
- `@xyz-xyz` and `@xyz xyz` to resolve to the same agent

Implementation note:

- introduce a shared mention-normalization helper if the UI and server need the same logic
- add alias/search text support to mention options if the dropdown only searches by `name` today
- preserve company scoping and existing notification deduplication behavior

## Components and Data Flow

### UI

- `ui/src/pages/IssueDetail.tsx`
  - pass comment-order preference to `CommentThread`
  - keep document section behavior unchanged except for default fold state
- `ui/src/components/CommentThread.tsx`
  - sort timeline based on company preference
- `ui/src/components/IssueDocumentsSection.tsx`
  - initialize folded state to collapsed-by-default
- `ui/src/components/MarkdownEditor.tsx`
  - support alias-aware mention matching
- `ui/src/pages/CompanySettings.tsx`
  - expose the new issue comment order setting

### Server

- `packages/db/src/schema/companies.ts`
  - add the new company setting column if not already present
- `packages/shared/src/types/company.ts`
  - add the field to the shared company type
- `packages/shared/src/validators/company.ts`
  - add validation for the new setting
- `server/src/routes/companies.ts`
  - accept and return the new field
- `server/src/services/issues.ts`
  - resolve agent mentions using the canonicalized tokens
- `server/src/routes/issues.ts`
  - ensure comment creation uses the resolver and notification path

## Testing Strategy

### Document folding

- verify a first-time issue load starts with folded documents
- verify per-issue local storage still restores prior user preference
- verify hash scrolling expands the targeted document

### Comment order

- verify newest-first and newest-last ordering in `CommentThread`
- verify the company setting persists through API round trips

### Mention fallback

- verify `@ceo` resolves to the CEO agent
- verify `@xyz-xyz` and `@xyz xyz` both resolve to the same agent when normalized
- verify server notifications are emitted once per resolved agent

