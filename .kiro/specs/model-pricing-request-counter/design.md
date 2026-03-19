# Design Document: Model Pricing and Request Counter

## Overview

Paperclip already receives token usage from several adapters, but cost calculation is not consistent. The solution is to introduce a shared pricing resolver that can map model identifiers to canonical pricing rules and to use that resolver in live execution and historical repair flows.

When a model reports usage but no dollar value, Paperclip should compute cost from the pricing list. When that cost ends up at zero, Paperclip should still count the run as a request so spending analytics can track activity for free or zero-cost models.

## Architecture

### Shared Pricing Resolver

The resolver should accept:
- raw model identifier
- provider name when available
- token usage fields
- existing adapter-reported cost when available

It should:
1. normalize the model identifier
2. strip provider prefixes and common runtime prefixes
3. attempt exact lookup in the pricing list
4. attempt regex or variant matching for model families
5. compute cost from input, output, and cached input token counts
6. return the adapter cost if it is valid and higher priority than computed fallback

### Historical Repair Flow

Older runs should be reprocessed from stored run data. The repair flow should:
- read stored usage and model metadata
- recompute cost using the same shared resolver
- update missing or unusable cost values
- avoid rewriting rows that already have valid pricing
- be safe to run repeatedly

### Request Counter Flow

The request counter should be derived from usage-bearing runs, not from spend alone. That means:
- cost greater than zero increments spend and request totals as usual
- cost equal to zero still increments request totals when usage exists
- runs with no usage remain excluded

The reporting layer should expose this as a separate metric so the spending screen can show both dollars and request volume.

## Data Flow

1. Adapter returns usage, model, and optional cost
2. Shared resolver normalizes model and resolves pricing
3. Server stores computed or preserved cost
4. Reporting layer aggregates cost and request count
5. Historical backfill reuses the same resolver

## Implementation Notes

- Use a single canonical pricing lookup source instead of hardcoding pricing per adapter
- Prefer explicit model aliases when available, then regex fallback
- Keep adapters thin; pricing logic should live in one shared layer
- Preserve zero-cost runs in analytics so they can be counted
- Make backfill idempotent so it can be rerun safely

## Risks

- Model naming drift can cause lookup misses if the resolver is too strict
- Regex fallback can accidentally match the wrong family if patterns are broad
- Historical backfill can touch a large number of rows, so it should be bounded and resumable
- Request counting must not double count runs that are both backfilled and observed live
