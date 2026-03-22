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
    devices.ts       ← device types, location grouping, ring_devices mapping
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

**`package.json` scripts (aligned with monorepo conventions):**
```json
{
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run",
    "dev": "tsc --watch"
  }
}
```

Test runner: **vitest** (matches monorepo convention).

---

## Public API

```typescript
import { RingClient, RingAuthError, Requires2FAError, RingTokenExpiredError, RingNetworkError } from '@walt/ring-client'

const client = new RingClient({
  email: 'you@example.com',
  password: 'secret',
  onTokenUpdate: (tokens) => saveToDb(tokens),  // persist tokens between restarts
  savedTokens: loadFromDb(),                     // skip re-auth on startup
  // tokens object includes: { access_token, refresh_token, expires_in, hardware_id }
  // hardware_id must be persisted — if it changes, Ring creates a new auth entry
})

// Authenticate (handles 2FA via callback if needed)
// on2FA must return Promise<string> — Ring OTPs can have leading zeros, never cast to number
await client.auth({ on2FA: async (): Promise<string> => prompt('Enter 2FA code: ') })

// Get all devices grouped by location (maps to your properties)
const locations = await client.getLocations()
// [{ id: '123456', name: 'Beach House', devices: [...] }, ...]
// Note: Ring location IDs are numeric strings — do not coerce to number

// Listen for events across all devices
// Fires once per unique event regardless of whether FCM or polling delivered it
client.onEvent((event) => {
  // kind: 'ding' | 'motion' | 'intercom_unlock'
  console.log(event.locationId, event.deviceId, event.kind, event.timestamp)
})

// Fetch recent event history for a device — returns Promise<RingEvent[]>
// Note: 'answered' field may be absent for motion events
const history = await client.getHistory(deviceId, { limit: 50 })

// Fetch snapshot image buffer for a device (JPEG)
const imageBuffer = await client.getSnapshot(deviceId) // returns Promise<Buffer>

// Check whether FCM is connected or degraded (polling-only mode)
const status = client.getStatus()
// { fcm: 'connected' | 'degraded' | 'disabled', polling: 'active' | 'stopped' }

// Graceful teardown — stops polling loop and FCM listener, allows process to exit
await client.disconnect()
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

   → 200: store { access_token, refresh_token, expires_in, hardware_id }
   → 412: 2FA required — call on2FA() callback (returns Promise<string>),
          re-POST with headers: '2fa-support: true', '2fa-code: <otp>'
          OTP must remain a string to preserve leading zeros

2. Subsequent startups
   Load savedTokens (must include hardware_id) → bypass login

3. Token expiry (401 on any API call)
   Auto-refresh: POST with grant_type=refresh_token
   Call onTokenUpdate() with new tokens (includes hardware_id)
   If refresh fails → emit RingTokenExpiredError, stop polling and FCM listener

4. Hardware ID
   UUID v5 hash of machine node + user agent string
   MUST be included in the persisted token bundle — if it changes on restart,
   Ring will create a new authorized device entry and may rate-limit the account
```

Token persistence is the **caller's responsibility**. The package calls `onTokenUpdate` when tokens change and accepts `savedTokens` on init. The `savedTokens` / `onTokenUpdate` token object shape:

```typescript
type RingTokens = {
  access_token: string
  refresh_token: string
  expires_in: number
  hardware_id: string  // must be persisted alongside auth tokens
}
```

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
  id: string        // numeric string e.g. '123456' — do not coerce to number
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
  answered?: boolean  // may be absent for motion events
}
```

**Device response mapping:** `/clients_api/ring_devices` returns a keyed object, not a flat array. The package flattens it as follows:

| Response key           | `RingDevice.kind` |
|------------------------|-------------------|
| `doorbots`             | `doorbell`        |
| `authorized_doorbots`  | `doorbell`        |
| `stickup_cams`         | `stickup_cam`     |
| `chimes`               | `chime`           |
| everything else        | `other`           |

Devices are then grouped by their `location_id` field to form `RingLocation[]`.

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
  │     If registration fails → log warning, mark status as 'degraded'
  │     (polling continues as sole event source — no silent failure)
  │
  └─→ Polling (fallback, always running)
        Every 30s: GET /clients_api/doorbots/history?limit=10 per device
        (NOT /dings/active — that only returns currently-ringing calls)
        Track seen event IDs in a bounded Map (max 1000 entries, evict oldest)
        New event ID → emit RingEvent
```

**Deduplication:** event IDs tracked in a `Map<string, Date>` capped at 1000 entries (oldest evicted when cap reached). If FCM and polling both deliver the same event, `onEvent` fires only once. The map resets on restart — any events that occurred while the process was down will be re-emitted on the first poll (acceptable for the use case).

**FCM implementation note:** Uses a Node.js FCM client library to act as a Firebase Android client using Ring's hardcoded credentials (sender ID `876313859327`, app ID `1:876313859327:android:e10ec6ddb3c81f39`). The Firebase registration flow (obtaining a `gcm_token`) relies on the legacy FCM protocol. If FCM registration fails at runtime, the package degrades gracefully to polling-only and exposes this via `client.getStatus()`. The caller should check status on startup and can choose to alert if FCM is unavailable.

**Error propagation in long-running mode:** If token refresh fails mid-run, the poller stops and `onEvent` receives a final call with a synthetic `RingTokenExpiredError` event kind — or the caller should register an `onError` handler:

```typescript
client.onError((err) => {
  if (err instanceof RingTokenExpiredError) {
    // trigger re-auth flow
  }
})
```

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
- Poller tested with mock history responses + deduplication + eviction logic
- FCM tested by simulating incoming message payloads directly
- Degraded mode tested by simulating FCM registration failure
- **Integration tests** (optional, skipped in CI via `RING_INTEGRATION=true` env flag) hit real Ring API using env-var credentials
- No real Ring calls in CI — avoids account lockout risk
- Test runner: **vitest**

---

## Out of Scope (v1)

- Live video streaming
- Device control (lights, chimes, siren)
- Light groups
- Snapshot scheduling / continuous capture
- Publishing to public npm
