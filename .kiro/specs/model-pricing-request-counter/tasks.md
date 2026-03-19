# Implementation Plan: Model Pricing and Request Counter

## Tasks

- [ ] 1. Add shared pricing resolver
  - Normalize model identifiers and provider prefixes
  - Resolve pricing from the canonical model pricing list
  - Add regex or variant fallback for model families
  - Keep adapter-reported cost when it is already valid

- [ ] 2. Integrate pricing into adapters and shared billing flow
  - Apply the shared resolver to all adapters that report usage
  - Ensure live runs with token usage but missing cost are priced
  - Keep adapters without usage support from failing

- [ ] 3. Add historical backfill
  - Reprocess older completed runs using stored usage and model metadata
  - Fill in missing or unusable cost values
  - Keep the backfill idempotent

- [ ] 4. Add request counter support
  - Count usage-bearing runs even when computed cost is zero
  - Persist request counter data for reporting
  - Expose the metric in the spending screen

- [ ] 5. Add tests and verification
  - Test exact match, prefix normalization, and regex fallback
  - Test zero-cost request counting
  - Test historical backfill idempotency and preserved valid costs

- [ ] 6. Final review
  - Check pricing behavior across current and historical runs
  - Verify the spending screen shows request counts correctly
