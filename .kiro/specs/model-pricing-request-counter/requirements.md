# Requirements Document: Model Pricing and Request Counter

## Introduction

This document defines the requirements for fixing token usage and pricing calculation across adapters and models in Paperclip. Some adapters currently return token usage without a computed cost, and some historical runs were not priced even though they should have been. This work adds a shared pricing path, backfills older runs, and exposes a request counter for zero-cost but usage-bearing runs so spending reports remain accurate.

## Glossary

- Adapter: a runtime integration that executes agent work
- Model pricing list: the canonical list of model rates used to compute cost
- Request counter: a usage counter for runs that produced tokens but no dollar cost
- Historical backfill: a repair process that reprocesses older runs
- Zero-cost run: a run that returned usage data and a zero or missing cost value
- Pricing resolver: shared logic that maps model identifiers to pricing rules

## Requirements

### Requirement 1: Shared Pricing Resolution

**User Story:** As a Board Operator, I want model token usage to be priced consistently, so that every supported adapter reports cost even when the adapter itself does not compute it.

#### Acceptance Criteria

1. THE system SHALL resolve cost from token usage and the model pricing list when an adapter does not provide costUsd
2. THE system SHALL support exact model matches, provider-prefixed aliases, and regex-based variant matching
3. THE system SHALL normalize model identifiers before pricing lookup
4. THE system SHALL apply the same pricing logic across all adapters and all supported models
5. WHEN an adapter already returns a valid costUsd, THE system SHALL preserve it unless the value is clearly missing or unusable

### Requirement 2: Historical Backfill

**User Story:** As a Board Operator, I want older runs to be repaired with the same pricing logic, so that past spending reports remain consistent.

#### Acceptance Criteria

1. THE system SHALL backfill previously completed runs that have usage data but missing or zero cost
2. THE backfill process SHALL apply the same pricing resolver used for live runs
3. THE backfill process SHALL be idempotent
4. THE backfill process SHALL only touch runs that can be safely re-evaluated from stored usage and model data
5. THE backfill process SHALL preserve existing valid cost data

### Requirement 3: Request Counter for Zero-Cost Runs

**User Story:** As a Board Operator, I want zero-cost but usage-bearing runs to appear in spending analytics, so that I can track request volume even when a model costs nothing.

#### Acceptance Criteria

1. WHEN a run has token usage but the computed cost is zero, THE system SHALL increment a request counter
2. THE system SHALL record request counter data for adapters and models that support usage reporting
3. THE request counter SHALL be visible in the spending screen
4. THE request counter SHALL not replace cost reporting
5. THE request counter SHALL work for both live runs and backfilled historical runs

### Requirement 4: Adapter Coverage

**User Story:** As a Board Operator, I want this behavior to work across all adapters, so that I do not need to manage model-specific exceptions manually.

#### Acceptance Criteria

1. THE system SHALL apply pricing resolution to all current adapters that report tokens or model identifiers
2. THE system SHALL apply the request counter to all adapters that can produce usage data
3. THE system SHALL support future adapters without requiring duplicated pricing logic
4. THE system SHALL handle adapters that do not report usage without failing

### Requirement 5: Verification

**User Story:** As a Developer, I want coverage for pricing and request counting, so that regressions are caught early.

#### Acceptance Criteria

1. THE shared pricing resolver SHALL have unit tests for exact match, prefix normalization, and regex fallback
2. THE historical backfill SHALL have tests for idempotency and preserved valid cost data
3. THE request counter reporting SHALL have tests for zero-cost usage-bearing runs
4. THE adapter integration SHALL have tests for models that return usage without cost
