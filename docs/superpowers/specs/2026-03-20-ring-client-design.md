# ring-client — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Location:** `packages/ring-client` (internal monorepo package, `@walt/ring-client`)

---

## Overview

A TypeScript Ring API client for Node.js, ported from `python-ring-doorbell`. Lives as a private internal package in the `host-ai` monorepo. Primary use case: per-property doorbell/motion event tracking for smart traffic-pattern detection (suppress noisy individual notifications, alert on unusual activity).

---

## Package Structure

```
packages/ring-client/
  src/
    auth.ts          ← token fetch, refresh, 2FA flow, hardware ID
    client.ts        ← RingClient class (main entry point)
    devices.ts       ← device types, location grouping
    events.ts        ← RingEvent type, EventKind enum
    poller.ts        ← polling loop (history endpoint)
    fcm.ts           ← FCM registration + push listener
    http.ts          ← base HTTP layer (fetch + auth headers)
    const.ts         ← Ring API endpoints, client ID, hardcoded values
  index.ts           ← public API exports only
  package.json
  tsconfig.json
```

`RingClient` is the only public class. All internal modules are implementation details.

---

## Public API

```typescript
import { RingClient } from '@walt/ring-client'

const client = new RingClient({
  email: 'you@example.com',
  password: 'secret',
  onTokenUpdate: (tokens) => saveToDb(tokens),  // persist tokens between restarts
  savedTokens: loadFromDb(),                     // skip re-auth on startup
})

// Authenticate (handles 2FA via callback if needed)
await client.auth({ on2FA: async () => prompt('Enter 2FA code: ') })

// Get all devices grouped by location (maps to properties)
const locations = await client.getLocations()
// [{ id: 'abc', name: 'Beach House', devices: [...] }, ...]

// Listen for events across all devices
client.onEvent((event) => {
  // kind: 'ding' | 'motion' | 'intercom_unlock'
  console.log(event.locationId, event.deviceId, event.kind, event.timestamp)
})

// Fetch recent event history for a device
const history = await client.getHistory(deviceId, { limit: 50 })

// Fetch snapshot image for a device
const imageBuffer = await client.getSnapshot(deviceId)
```

---

## Authentication Flow

Uses Ring's unofficial OAuth endpoint with their official Android client credentials.

```
1. First login
   POST https://oauth.ring.com/oauth/token
   BasicAuth: client_id=ring_official_android, password=(empty)
   Body: { username, password, scope: 'client', grant_type: 'password',
           client_id: 'ring_official_android', include_client_id: true }

   → 200: store { access_token, refresh_token, expires_in }
   → 412: 2FA required — call on2FA() callback, re-POST with headers:
          '2fa-support: true', '2fa-code: <otp>'

2. Subsequent startups
   Load savedTokens → bypass login

3. Token expiry (401 on any API call)
   Auto-refresh: POST with grant_type=refresh_token
   Call onTokenUpdate() with new tokens

4. Hardware ID
   UUID v5 hash of machine node + user agent string
   Persisted by caller (passed in config), prevents duplicate auth entries
```

Token persistence is the **caller's responsibility**. The package calls `onTokenUpdate` when tokens change and accepts `savedTokens` on init.

**Ring API constants (from python-ring-doorbell):**
- OAuth: `https://oauth.ring.com/oauth/token`
- API base: `https://api.ring.com/clients_api`
- Client ID: `ring_official_android`
- User Agent: `android:com.ringapp`
- API version: `11`

---

## Device & Location Model

```typescript
type RingLocation = {
  id: string
  name: string
  devices: RingDevice[]
}

type RingDevice = {
  id: string
  locationId: string
  kind: 'doorbell' | 'stickup_cam' | 'chime' | 'other'
  description: string
}

type RingEvent = {
  id: string
  deviceId: string
  locationId: string
  kind: 'ding' | 'motion' | 'intercom_unlock'
  timestamp: Date
  answered: boolean
}
```

Devices are fetched from `/clients_api/ring_devices` and grouped by `location_id`.

---

## Event Delivery (FCM + Polling)

Both transports run in parallel. The caller receives a single unified `onEvent` stream — transport is an implementation detail.

```
Startup
  │
  ├─→ FCM (real-time)
  │     Register with Firebase using Ring's hardcoded app credentials
  │     PATCH Ring API to associate FCM token with this device
  │     On incoming push → parse modern/legacy format → emit RingEvent
  │
  └─→ Polling (fallback, always running)
        Every 30s: GET /clients_api/dings/active per device
        Track seen event IDs in memory
        New ID → emit RingEvent
```

**Deduplication:** event IDs tracked in a `Set`. If FCM and polling both deliver the same event, `onEvent` fires only once.

**FCM implementation:** Uses `push-receiver` npm package to act as a Firebase Android client without a real device. Ring's Firebase credentials (sender ID `876313859327`, app ID from `const.py`) are used for registration.

---

## Error Types

```typescript
RingAuthError         // bad credentials (401 on initial login)
Requires2FAError      // 412 returned but no on2FA callback provided
RingTokenExpiredError // refresh token invalid, user must re-auth
RingNetworkError      // API unreachable or timeout
```

All errors are exported from `index.ts` for typed `catch` handling in consumers.

---

## Testing Strategy

- **Unit tests** mock `http.ts` — no real Ring API calls
- Auth flow tested with fixture responses: 200, 412 (2FA), 401 (refresh)
- Poller tested with mock history responses + deduplication logic
- FCM tested by simulating incoming message payloads directly
- **Integration tests** (optional, skipped in CI) hit real Ring API using env-var credentials
- No real Ring calls in CI — avoids account lockout risk

---

## Out of Scope (v1)

- Live video streaming
- Device control (lights, chimes, siren)
- Light groups
- Snapshot scheduling / continuous capture
- Publishing to public npm
