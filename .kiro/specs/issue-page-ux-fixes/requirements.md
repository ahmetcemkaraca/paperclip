# Requirements Document: Issue Page UX Fixes

## Introduction

This spec covers three related issue-page usability and reliability fixes in Paperclip:

1. Issue documents should be collapsed by default so users do not have to scroll past long expanded documents to reach recent comments.
2. Company settings should control whether issue timelines render newest comments first or newest comments last.
3. Mention parsing and autocomplete should resolve agent references robustly, including `@ceo` and whitespace/hyphen variants such as `@xyz xyz` matching `@xyz-xyz`.

The change set is company-scoped for configurable behavior and must preserve existing issue/comment access controls.

## Glossary

- **Issue_Page**: The issue detail screen and its comment/document sections.
- **Issue_Document**: A document attached to an issue and rendered in `IssueDocumentsSection`.
- **Comment_Timeline**: The ordered list of issue comments and linked runs shown in `CommentThread`.
- **Comment_Order**: Company-level preference for timeline ordering.
- **Mention_Option**: A selectable entity shown in the markdown editor mention dropdown.
- **Mention_Resolution**: Server-side logic that maps raw `@` text to agent IDs for notifications and tagging.

## Requirements

### Requirement 1: Issue documents are collapsed by default

**User Story:** As a user on an issue page, I want issue documents to start collapsed, so that the newest comments and issue context are visible without extra scrolling.

#### Acceptance Criteria

1. THE IssueDocumentsSection SHALL render issue documents collapsed on first load when there is no prior per-issue saved state.
2. WHEN a user expands or collapses a document, THE UI SHALL preserve that preference per issue in local storage.
3. WHEN an issue hash targets a specific document, THE UI SHALL temporarily expand that document so the anchor scroll still works.
4. THE default collapsed behavior SHALL NOT require a database migration.

### Requirement 2: Company-controlled comment order

**User Story:** As a company operator, I want to choose whether newest comments appear first or last in issue threads, so that the issue page matches our team's workflow.

#### Acceptance Criteria

1. THE Company settings UI SHALL expose a setting for issue comment order with at least two choices: newest first and newest last.
2. THE setting SHALL be company-scoped and persisted with company configuration.
3. WHEN the setting is newest first, THE CommentThread SHALL render the newest comments and linked run items at the top.
4. WHEN the setting is newest last, THE CommentThread SHALL preserve the existing chronological ordering with newest items at the bottom.
5. THE default for existing companies SHALL preserve current behavior unless an operator changes it.
6. THE setting SHALL be available through the company settings API and reflected in shared company types/validators.

### Requirement 3: Agent mention resolution and autocomplete are alias-aware

**User Story:** As a user or agent writing issue comments, I want `@ceo` and similar agent mentions to resolve reliably even when the token formatting differs slightly, so that the correct agent is tagged and notified.

#### Acceptance Criteria

1. WHEN the issue markdown editor shows agent mentions, THE dropdown SHALL match both display names and safe alias forms.
2. WHEN a mention is entered as `@xyz-xyz` or `@xyz xyz`, THE UI SHALL resolve it to the same agent suggestion when those forms refer to the same agent.
3. WHEN `@ceo` is used and there is a matching CEO agent alias or name, THE mention autocomplete SHALL surface that agent.
4. THE server-side mention resolver SHALL use the same canonicalization rules as the UI, so notifications are sent even when the rendered mention text does not exactly match the stored agent display name.
5. THE mention resolver SHALL remain defensive and only tag agents that belong to the same company.
6. THE mention fallback SHALL not create duplicate notifications for the same resolved agent within a single comment.

### Requirement 4: Verification coverage

**User Story:** As a maintainer, I want explicit tests for these issue-page behaviors, so that regressions are caught early.

#### Acceptance Criteria

1. THE test suite SHALL include coverage for default-collapsed issue documents.
2. THE test suite SHALL include coverage for company-level comment ordering.
3. THE test suite SHALL include coverage for mention resolution of `@ceo` and whitespace/hyphen alias fallbacks.
4. THE tests SHALL cover both UI-level suggestion behavior and server-side notification/tag resolution where practical.
