# Auto-Approval for Agent API Requests

Paperclip now supports automatic approval of API requests from agents to internal (Paperclip-owned) endpoints.

## Overview

When an agent requests permission to make an API call (HTTP request) to a Paperclip internal endpoint, the request is automatically approved without requiring human intervention. This enables:

- Agents to call the Paperclip API (e.g., `GET /api/agents/me`, `GET /api/companies/{companyId}/issues`)
- Faster heartbeat cycles
- Unblocked agent operations during autonomous runs

## How It Works

1. Agent attempts to make an HTTP request via sandboxed adapter (e.g., Claude Local, Codex Local)
2. The adapter creates an approval request of type `make_request`
3. The approval service checks if this should be auto-approved by:
   - Verifying the agent is authenticated and from the same company
   - Checking if the target URL matches whitelisted internal patterns
   - If both conditions are met, auto-approves with status `approved` and `decidedByUserId="system:auto-approval"`
4. Auto-approved requests immediately trigger the agent wakeup (same as manual approval)
5. Agent continues execution without delay

## Configuration

### Environment Variables

Set these in your Paperclip `.env` or environment:

```bash
# Enable/disable auto-approval for internal API calls (default: true)
PAPERCLIP_AUTO_APPROVE_INTERNAL_API=true

# Comma-separated URLs to auto-approve (in addition to defaults)
# Default includes: http://localhost:*, http://127.0.0.1:*, $PAPERCLIP_API_URL
PAPERCLIP_AUTO_APPROVE_URL_WHITELIST="https://internal.api.example.com,https://services.internal.local"
```

### Default Whitelisted Patterns

The following URL patterns are automatically whitelisted by default:

- `http://localhost:*` — localhost on any port
- `http://127.0.0.1:*` — loopback IP on any port
- `http://[::]:*` — IPv6 localhost on any port
- Value of `$PAPERCLIP_API_URL` — e.g., `http://localhost:3000`, `https://paperclip.example.com`

Any additional custom URLs should be added via `PAPERCLIP_AUTO_APPROVE_URL_WHITELIST`.

## Supported Approval Types

The auto-approval system currently recognizes these approval request types:

- `make_request` — Generic HTTP request
- `http_request` — HTTP request variant
- `fetch_request` — Fetch API request
- `api_call` — API call variant

## Approval Payload Format

When an adapter creates an approval request for an API call, it should use one of these payload formats:

```json
{
  "type": "make_request",
  "payload": {
    "url": "http://localhost:3000/api/agents/me",
    "method": "GET",
    "headers": { "Authorization": "Bearer <token>" }
  }
}
```

The auto-approval service will look for any of these fields in the payload:
- `url`
- `targetUrl`
- `endpoint`
- `uri`
- `address`

## Activity Logging

Auto-approved requests create specific activity log entries:

- `approval.created_and_auto_approved` — Approval request was created and immediately auto-approved
- `approval.auto_approved` — Approval was auto-approved during creation
- `approval.requester_wakeup_queued` — Agent was woken up to continue execution

These logs make it easy to audit which API calls were auto-approved.

## Security Considerations

### URL Validation

- URLs must **exactly** match the start of whitelisted patterns
- Use full URLs when specifying custom whitelist entries
- Partial matches prevent overrides (e.g., `http://example.com/api` won't match `http://example.com/admin`)

### Agent Validation

- Auto-approval only works for **authenticated agents** from the **requesting company**
- Cross-company requests are still gated
- Unauthenticated requests are still gated

### Disabling Auto-Approval

To require manual approval for all requests:

```bash
PAPERCLIP_AUTO_APPROVE_INTERNAL_API=false
```

Or do not set `PAPERCLIP_AUTO_APPROVE_URL_WHITELIST` beyond defaults — external URLs will be blocked.

## Troubleshooting

### "Approval still pending"

Check:
1. Is `PAPERCLIP_AUTO_APPROVE_INTERNAL_API` set to `true`?
2. Does the target URL match a whitelisted pattern?
3. Is the agent authenticated from the correct company?

### "URL rejected"

Make sure the full URL (scheme + host + port) matches your whitelist. For example:

- ✅ Good: `http://localhost:3000` (matches localhost on any port)
- ❌ Bad: `localhost:3000` (missing `http://`)
- ❌ Bad: `http://example.com/api` (won't match `http://example.com/admin`)

## Future Enhancements

Potential improvements:

- Per-agent whitelist overrides
- Request method filtering (allow only GET/POST)
- Response size limits for auto-approved calls
- Cost-based auto-approval (small requests auto-approved, large requests gated)
