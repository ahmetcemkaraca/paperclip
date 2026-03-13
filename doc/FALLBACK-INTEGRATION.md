# Fallback Adapter Integration Guide

## Overview

The fallback feature allows Paperclip to automatically retry agent execution with an alternative adapter/model when the initial execution fails due to rate-limiting or quota exhaustion.

## Architecture

### Database Schema
- `agents.fallback_config` - Agent-level fallback configuration (JSON)
- `companies.fallback_config` - Company-level fallback configuration (JSON)

### Configuration Structure
```typescript
interface FallbackConfig {
  enabled?: boolean;                           // Enable/disable fallback
  adapterType?: string;                        // Alternative adapter (optional)
  modelId?: string;                            // Alternative model ID (required if enabled)
  rateLimitKeywords?: string[];                // Custom detection keywords
}
```

### API Endpoints
- `GET /api/companies/:companyId/fallback-config` - Get company fallback config
- `PUT /api/companies/:companyId/fallback-config` - Update company fallback config
- `GET /api/agents/:agentId/fallback-config` - Get agent fallback config  
- `PUT /api/agents/:agentId/fallback-config` - Update agent fallback config

## Implementation Points

### 1. Rate-Limit Detection (DONE)
File: `server/src/services/fallback.ts`

Functions exported:
- `detectRateLimitInResult()` - Analyzes AdapterExecutionResult for rate-limit keywords
- `resolveFallbackConfig()` - Resolves which fallback config to use (agent > company)
- `shouldAttemptFallback()` - Determines if fallback should be attempted
- `containsRateLimitKeywords()` - Helper to detect keywords in text

### 2. Integration into Heartbeat Execution

**File to modify:** `server/src/services/heartbeat.ts`

**Current execution flow:**
```
1. Build execution context and workspace
2. Execute adapter (await adapter.execute())
3. Process result (session state, status updates, activity logging)
```

**Required integration points:**

After `adapter.execute()` returns (around line 1440):
```typescript
// Step 1: Get company fallback config
const company = await db.select().from(companies)
  .where(eq(companies.id, agent.companyId));
const companyFallbackConfig = company?.fallbackConfig || {};

// Step 2: Check if fallback should be attempted
const shouldFallback = shouldAttemptFallback(
  agent.fallbackConfig || {},
  companyFallbackConfig,
  adapterResult,
);

// Step 3: If fallback needed, determine config
let finalAdapterResult = adapterResult;
let usingFallback = false;

if (shouldFallback) {
  const fallbackConfig = resolveFallbackConfig(
    agent.fallbackConfig || {},
    companyFallbackConfig,
  );
  
  if (fallbackConfig?.modelId) {
    // Step 4: Re-execute with fallback configuration
    const fallbackAdapter = getServerAdapter(
      fallbackConfig.adapterType || agent.adapterType,
    );
    
    const fallbackModel = fallbackConfig.modelId;
    const fallbackConfig_adjusted = {
      ...resolvedConfig,
      model: fallbackModel, // Update model if same adapter
      // Or update adapterConfig if different adapter
    };
    
    // Log fallback attempt
    await onLog(
      "stderr",
      `[paperclip] Rate limit detected. Retrying with fallback model: ${fallbackModel}\n`,
    );
    
    // Re-execute with fallback
    finalAdapterResult = await fallbackAdapter.execute({
      runId: run.id,
      agent: { ...agent, adapterType: fallbackConfig.adapterType || agent.adapterType },
      runtime: runtimeForAdapter,
      config: fallbackConfig_adjusted,
      context,
      onLog,
      onMeta: onAdapterMeta,
      authToken: authToken ?? undefined,
    });
    
    usingFallback = true;
    
    // Log fallback result
    await logActivity(db, {
      companyId: agent.companyId,
      actorType: "system",
      actorId: "fallback",
      action: "agent.fallback_executed",
      entityType: "agent",
      entityId: agent.id,
      details: {
        primary: {
          adapterType: agent.adapterType,
          model: agent.adapterConfig?.model || "unknown",
        },
        fallback: {
          adapterType: fallbackConfig.adapterType || agent.adapterType,
          model: fallbackModel,
        },
        result: finalAdapterResult.exitCode === 0 ? "success" : "failed",
      },
    });
  }
}

// Step 5: Use finalAdapterResult for all subsequent processing
// (instead of adapterResult)
const nextSessionState = resolveNextSessionState({
  codec: sessionCodec,
  adapterResult: finalAdapterResult, // Changed this
  previousParams: previousSessionParams,
  previousDisplayId: runtimeForAdapter.sessionDisplayId,
  previousLegacySessionId: runtimeForAdapter.sessionId,
});
```

### 3. Status and Session Management

The fallback retry is transparent to the task system:
- If fallback succeeds, the run is marked as successful
- All subsequent session/status updates use the fallback result
- Activity logs track both the initial failure and fallback execution
- Cost tracking accounts for both attempts

### 4. Configuration Persistence

User can configure fallback via:
1. **API**: Call PUT endpoints to set fallback config
2. **UI**: Add UI pages to configure fallback settings (Task 9-10)

Example configuration:
```json
// Company-level fallback (applies to all agents)
{
  "enabled": true,
  "modelId": "gpt-5.2-codex",  // Fallback to cheaper model
  "rateLimitKeywords": ["rate limit", "exceed", "quota"]
}

// Agent-level fallback (overrides company)
{
  "enabled": true,
  "adapterType": "cursor",  // Switch to different adapter
  "modelId": "gpt-5.3-codex",
  "rateLimitKeywords": []  // Use default keywords
}
```

## Default Rate-Limit Keywords

From `packages/shared/src/validators/fallback.ts`:
```typescript
[
  "usage limit",
  "usage exceeded",
  "quota exceeded",
  "rate limit",
  "rate limited",
  "throttl",
  "too many requests",
  "request timeout",
  "out of credits",
  "insufficient credits",
  "exceeded",
  "limit exceeded",
]
```

## Testing

Tests are located in: `server/src/__tests__/fallback.test.ts`

All 14 tests validate:
- Keyword detection (case-insensitive)
- Detection in various output streams
- Config priority resolution
- Fallback decision logic

## Future Enhancements

1. **Exponential backoff**: Add delays between attempts
2. **Attempt tracking**: Store number of fallback attempts in run metadata
3. **Fallback chains**: Support multiple fallback levels
4. **Cost analysis**: Track cost differences between primary and fallback
5. **Metrics dashboard**: Visualize fallback usage patterns
6. **Admin controls**: Configure default fallback policies globally

## References

- Share types: `@paperclipai/shared` exports `FallbackConfig`
- Shared validators: `fallbackConfigSchema`, `DEFAULT_RATE_LIMIT_KEYWORDS`
- Activity logging: `logActivity(db, { ... } )`
