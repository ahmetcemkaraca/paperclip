## Summary

Add native Web Push API (browser notification) support to Paperclip. Currently, real-time updates are delivered only via in-app toast notifications and WebSocket. Users offline or with the browser closed cannot receive notifications.

## Problem

- Users miss critical updates when the browser is closed or minimized
- No persistent notification system across sessions
- Only in-app toast notifications (WebSocket-based) are supported today

## Solution

Implement Web Push notifications using the Service Worker Push API:

1. **Service Worker**: Add `push` and `notificationclick` event handlers
2. **Client**: Add permission request + subscription UI (settings page)
3. **Server**: Add `/api/notifications/subscribe` endpoint + VAPID key management
4. **Push Delivery**: Integrate `web-push` library for server-to-client messaging
5. **Documentation**: Update setup guides with HTTPS/security requirements

## Technical Details

### Files to Update

- `ui/public/sw.js` - Add push event handler and showNotification()
- `ui/src/` - Add notification settings UI + subscription logic
- `server/src/routes/` - Add POST /api/notifications/subscribe endpoint
- `server/src/` - Add notification service with web-push integration
- `server/src/config.ts` - Add VAPID_PUBLIC and VAPID_PRIVATE config vars
- `doc/DOCKER.md` - Document VAPID key setup and HTTPS requirement
- `doc/DEPLOYMENT-MODES.md` - Note security/HTTPS requirement for Push API

### Architecture

```
User clicks "Enable Notifications"
  ↓
Client: Notification.requestPermission() → subscription
  ↓
PushSubscription (endpoint, keys) sent to server
  ↓
Server stores subscription
  ↓
Event trigger (task status, issue update, etc.)
  ↓
Server calls web-push.sendNotification(subscription, payload)
  ↓
Service Worker receives push → showNotification()
  ↓
User sees browser notification, can click to navigate
```

## Requirements

- **HTTPS required** (Web Push API enforces HTTPS in production)
- Private networks: Tailscale or self-signed certs for dev/testing
- VAPID key generation and rotation strategy

## Definition of Done

- [ ] Service worker push event handler implemented
- [ ] Client notification permission + subscription UI added
- [ ] Server subscription endpoint (/api/notifications/subscribe)
- [ ] Push delivery service (web-push integration)
- [ ] VAPID key config support (PAPERCLIP_VAPID_PUBLIC, PRIVATE)
- [ ] Documentation updated with setup steps and HTTPS requirements
- [ ] Basic E2E example or test demonstrating push delivery

## Related Issues

- #581 HTTPS/TLS support (prerequisite for production Web Push)

## Priority

Medium - enhances UX for distributed teams, but optional feature
