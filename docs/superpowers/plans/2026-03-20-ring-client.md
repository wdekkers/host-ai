# ring-client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@walt/ring-client` — a TypeScript Ring API client in `packages/ring-client` that authenticates with Ring, lists devices grouped by location, and delivers doorbell/motion events via a unified `onEvent` callback backed by FCM push and polling fallback.

**Architecture:** A single `RingClient` class wires together an auth module (OAuth + 2FA + token refresh), a device fetcher, a polling loop (history endpoint), and an FCM push listener. Both event transports emit into a shared deduplication layer before calling the user's callback. Auth tokens (including `hardware_id`) are persisted by the caller via `onTokenUpdate`/`savedTokens`. The HTTP layer handles 401s by calling a refresh callback and retrying once.

**Tech Stack:** TypeScript (NodeNext ESM), `@eneris/push-receiver` for FCM, `vitest` for tests, `node:crypto` for hardware ID, native `fetch` for HTTP.

---

## File Map

| File | Responsibility |
|------|---------------|
| `packages/ring-client/package.json` | Package metadata, scripts, dependencies |
| `packages/ring-client/tsconfig.json` | Extends monorepo base config |
| `packages/ring-client/eslint.config.mjs` | ESLint config (extends `@walt/config-eslint`) |
| `packages/ring-client/vitest.config.ts` | Vitest config |
| `packages/ring-client/src/const.ts` | All Ring API endpoints, client ID, Firebase credentials |
| `packages/ring-client/src/errors.ts` | All typed error classes |
| `packages/ring-client/src/http.ts` | Base fetch wrapper — injects auth headers, handles 401 with refresh+retry |
| `packages/ring-client/src/auth.ts` | Token fetch, 2FA flow, token refresh, hardware ID generation |
| `packages/ring-client/src/devices.ts` | Fetch + flatten `ring_devices`, fetch location names, group by `location_id` |
| `packages/ring-client/src/events.ts` | `RingEvent` type, `EventKind` enum, deduplication Map |
| `packages/ring-client/src/poller.ts` | Polling loop over `/doorbots/history`, emits deduplicated events |
| `packages/ring-client/src/fcm.ts` | FCM registration with Ring, push listener, graceful degradation |
| `packages/ring-client/src/client.ts` | `RingClient` class — wires all modules, public API |
| `packages/ring-client/src/index.ts` | Public exports only |
| `packages/ring-client/src/__tests__/http.test.ts` | HTTP client unit tests |
| `packages/ring-client/src/__tests__/auth.test.ts` | Auth unit tests |
| `packages/ring-client/src/__tests__/devices.test.ts` | Device mapping unit tests |
| `packages/ring-client/src/__tests__/events.test.ts` | Deduplicator unit tests |
| `packages/ring-client/src/__tests__/poller.test.ts` | Polling + deduplication tests |
| `packages/ring-client/src/__tests__/fcm.test.ts` | FCM degraded-mode tests |
| `packages/ring-client/src/__tests__/client.test.ts` | RingClient integration-style tests |

---

## Task 1: Scaffold the package

**Files:**
- Create: `packages/ring-client/package.json`
- Create: `packages/ring-client/tsconfig.json`
- Create: `packages/ring-client/eslint.config.mjs`
- Create: `packages/ring-client/vitest.config.ts`
- Create: `packages/ring-client/src/index.ts` (empty placeholder)

- [ ] **Step 1: Create `packages/ring-client/package.json`**

```json
{
  "name": "@walt/ring-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@eneris/push-receiver": "4.0.0"
  },
  "devDependencies": {
    "@walt/config-eslint": "workspace:*",
    "vitest": "^2.0.0"
  }
}
```

Note: `@eneris/push-receiver` is pinned exactly (`4.0.0`, no `^`) because the FCM MCS protocol implementation is fragile and upstream changes can break registration silently.

- [ ] **Step 2: Create `packages/ring-client/tsconfig.json`**

```json
{
  "extends": "../config-typescript/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`rootDir: "src"` ensures compiled output maps cleanly: `src/index.ts` → `dist/index.js`, matching `"main": "dist/index.js"`.

- [ ] **Step 3: Create `packages/ring-client/eslint.config.mjs`**

```js
import config from '@walt/config-eslint';
export default config;
```

- [ ] **Step 4: Create `packages/ring-client/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    restoreMocks: true,
    unstubGlobals: true,
  },
});
```

`restoreMocks: true` and `unstubGlobals: true` automatically clean up `vi.stubGlobal('fetch', ...)` and mock state between tests — no need for manual `afterEach` cleanup.

- [ ] **Step 5: Create empty `packages/ring-client/src/index.ts`**

```typescript
// exports added as modules are built
```

- [ ] **Step 6: Install dependencies**

```bash
pnpm install
```

Expected: pnpm resolves `@eneris/push-receiver` and `vitest` into `packages/ring-client/node_modules`.

> **Note:** If `@eneris/push-receiver` is not available, check `push-receiver` or `@homebridge/push-receiver` as alternatives — the FCM MCS protocol can break with Google updates. If FCM is entirely broken, the package degrades to polling-only (see Task 8).

- [ ] **Step 7: Verify typecheck passes on empty package**

```bash
pnpm --filter @walt/ring-client typecheck
```

Expected: PASS

- [ ] **Step 8: Commit scaffold**

```bash
git add packages/ring-client/
git commit -m "feat(ring-client): scaffold package"
```

---

## Task 2: Constants and errors

**Files:**
- Create: `packages/ring-client/src/const.ts`
- Create: `packages/ring-client/src/errors.ts`

- [ ] **Step 1: Create `packages/ring-client/src/const.ts`**

```typescript
export const RING_OAUTH_URL = 'https://oauth.ring.com/oauth/token';
export const RING_API_BASE = 'https://api.ring.com/clients_api';
export const RING_CLIENT_ID = 'ring_official_android';
export const RING_USER_AGENT = 'android:com.ringapp';
export const RING_API_VERSION = '11';

// Firebase credentials from Ring's official Android app (public, hardcoded in the app binary)
export const FCM_SENDER_ID = '876313859327';
export const FCM_APP_ID = '1:876313859327:android:e10ec6ddb3c81f39';
export const FCM_PROJECT_ID = 'ring-17770';
export const FCM_API_KEY = 'AIzaSyCv-hdFBmmdBBJadNy-TFwB-xN_H5m3Bk8';

// Polling interval in milliseconds
export const POLL_INTERVAL_MS = 30_000;

// Max event IDs to track for deduplication before evicting oldest
export const DEDUP_MAX_SIZE = 1000;

// Namespace UUID for hardware_id generation (from python-ring-doorbell)
export const HARDWARE_ID_NAMESPACE = '379378b0-f747-4b67-a10f-3b13327e8879';
```

- [ ] **Step 2: Create `packages/ring-client/src/errors.ts`**

```typescript
export class RingAuthError extends Error {
  constructor(message = 'Ring authentication failed') {
    super(message);
    this.name = 'RingAuthError';
  }
}

export class Requires2FAError extends Error {
  constructor(message = 'Ring requires 2FA but no on2FA callback was provided') {
    super(message);
    this.name = 'Requires2FAError';
  }
}

export class RingTokenExpiredError extends Error {
  constructor(message = 'Ring refresh token is invalid — re-authentication required') {
    super(message);
    this.name = 'RingTokenExpiredError';
  }
}

export class RingNetworkError extends Error {
  constructor(message = 'Ring API unreachable') {
    super(message);
    this.name = 'RingNetworkError';
  }
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @walt/ring-client typecheck
git add packages/ring-client/src/const.ts packages/ring-client/src/errors.ts
git commit -m "feat(ring-client): add constants and typed errors"
```

---

## Task 3: HTTP layer

**Files:**
- Create: `packages/ring-client/src/http.ts`
- Create: `packages/ring-client/src/__tests__/http.test.ts`

The HTTP layer injects auth headers and handles 401 by calling a `refreshToken` callback and retrying the request once. This is the correct place to handle token expiry — not in the caller.

- [ ] **Step 1: Write failing tests**

Create `packages/ring-client/src/__tests__/http.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createHttpClient } from '../http.js';

describe('createHttpClient', () => {
  it('injects Authorization and hardware_id headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const http = createHttpClient({
      getTokens: async () => ({ accessToken: 'test-token', hardwareId: 'hw-123' }),
      onTokenRefresh: vi.fn(),
    });
    await http.get('/some/path');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/some/path'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          hardware_id: 'hw-123',
        }),
      })
    );
  });

  it('calls onTokenRefresh and retries on 401', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const onTokenRefresh = vi.fn().mockResolvedValue('new-token');
    const getTokens = vi.fn()
      .mockResolvedValueOnce({ accessToken: 'old-token', hardwareId: 'hw' })
      .mockResolvedValueOnce({ accessToken: 'new-token', hardwareId: 'hw' });

    const http = createHttpClient({ getTokens, onTokenRefresh });
    await http.get('/path');

    expect(onTokenRefresh).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Second call must use refreshed token
    const secondCall = mockFetch.mock.calls[1] as [string, RequestInit];
    expect((secondCall[1].headers as Record<string, string>)['Authorization']).toBe('Bearer new-token');
  });

  it('throws RingNetworkError on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')));
    const http = createHttpClient({
      getTokens: async () => ({ accessToken: 'tok', hardwareId: 'hw' }),
      onTokenRefresh: vi.fn(),
    });
    await expect(http.get('/path')).rejects.toThrow('RingNetworkError');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @walt/ring-client test
```

Expected: FAIL — `http.js` not found

- [ ] **Step 3: Implement `packages/ring-client/src/http.ts`**

```typescript
import { RING_API_BASE, RING_USER_AGENT, RING_API_VERSION } from './const.js';
import { RingNetworkError } from './errors.js';

interface TokenInfo {
  accessToken: string;
  hardwareId: string;
}

interface HttpClientOptions {
  getTokens: () => Promise<TokenInfo>;
  onTokenRefresh: () => Promise<void>;
}

export interface HttpClient {
  get: <T>(path: string, params?: Record<string, string>) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
  patch: <T>(path: string, body: unknown) => Promise<T>;
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const { getTokens, onTokenRefresh } = options;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
    isRetry = false
  ): Promise<T> {
    const { accessToken, hardwareId } = await getTokens();
    const url = new URL(`${RING_API_BASE}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': RING_USER_AGENT,
      hardware_id: hardwareId,
      'X-API-LANG': 'en',
      'X-API-TIMEZONE': 'UTC',
      'X-API-VERSION': RING_API_VERSION,
    };
    if (body) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new RingNetworkError(`Fetch failed: ${String(err)}`);
    }

    // On first 401, refresh token and retry once
    if (response.status === 401 && !isRetry) {
      await onTokenRefresh();
      return request<T>(method, path, body, params, true);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    get: <T>(path: string, params?: Record<string, string>) =>
      request<T>('GET', path, undefined, params),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @walt/ring-client test
```

Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @walt/ring-client typecheck
git add packages/ring-client/src/http.ts packages/ring-client/src/__tests__/http.test.ts
git commit -m "feat(ring-client): add HTTP client with 401 refresh-and-retry"
```

---

## Task 4: Authentication

**Files:**
- Create: `packages/ring-client/src/auth.ts`
- Create: `packages/ring-client/src/__tests__/auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/ring-client/src/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { generateHardwareId, fetchToken, refreshToken } from '../auth.js';
import { Requires2FAError, RingAuthError, RingTokenExpiredError } from '../errors.js';

describe('generateHardwareId', () => {
  it('returns a consistent UUID string for the same hostname', () => {
    const id1 = generateHardwareId('my-server');
    const id2 = generateHardwareId('my-server');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns different IDs for different hostnames', () => {
    const id1 = generateHardwareId('server-a');
    const id2 = generateHardwareId('server-b');
    expect(id1).not.toBe(id2);
  });
});

describe('fetchToken', () => {
  it('returns tokens on successful login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        access_token: 'acc',
        refresh_token: 'ref',
        expires_in: 3600,
      }), { status: 200 })
    ));

    const result = await fetchToken({
      email: 'a@b.com',
      password: 'pw',
      hardwareId: 'hw-123',
    });

    expect(result.access_token).toBe('acc');
    expect(result.refresh_token).toBe('ref');
    expect(result.hardware_id).toBe('hw-123');
  });

  it('throws Requires2FAError when 412 and no on2FA callback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('', { status: 412 })
    ));
    await expect(
      fetchToken({ email: 'a@b.com', password: 'pw', hardwareId: 'hw' })
    ).rejects.toThrow(Requires2FAError);
  });

  it('retries with 2FA code when on2FA provided', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 412 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'acc2fa',
        refresh_token: 'ref2fa',
        expires_in: 3600,
      }), { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchToken({
      email: 'a@b.com',
      password: 'pw',
      hardwareId: 'hw',
      on2FA: async () => '012345',  // leading zero — must stay as string
    });

    expect(result.access_token).toBe('acc2fa');
    const secondCall = mockFetch.mock.calls[1] as [string, RequestInit];
    expect((secondCall[1].headers as Record<string, string>)['2fa-code']).toBe('012345');
  });

  it('throws RingAuthError on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(
      fetchToken({ email: 'a@b.com', password: 'pw', hardwareId: 'hw' })
    ).rejects.toThrow(RingAuthError);
  });
});

describe('refreshToken', () => {
  it('returns new tokens on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        access_token: 'new-acc',
        refresh_token: 'new-ref',
        expires_in: 3600,
      }), { status: 200 })
    ));
    const result = await refreshToken({ refreshTokenValue: 'old-ref', hardwareId: 'hw' });
    expect(result.access_token).toBe('new-acc');
    expect(result.hardware_id).toBe('hw');
  });

  it('throws RingTokenExpiredError on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(
      refreshToken({ refreshTokenValue: 'bad', hardwareId: 'hw' })
    ).rejects.toThrow(RingTokenExpiredError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @walt/ring-client test
```

Expected: FAIL — `auth.js` not found

- [ ] **Step 3: Implement `packages/ring-client/src/auth.ts`**

```typescript
import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import {
  RING_OAUTH_URL,
  RING_CLIENT_ID,
  RING_USER_AGENT,
  HARDWARE_ID_NAMESPACE,
} from './const.js';
import { RingAuthError, Requires2FAError, RingTokenExpiredError } from './errors.js';

export interface RingTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  hardware_id: string;
}

interface FetchTokenOptions {
  email: string;
  password: string;
  hardwareId: string;
  on2FA?: () => Promise<string>;
  otpCode?: string;
}

/**
 * Generates a stable hardware ID for this machine.
 * The ID is deterministic per machine (based on hostname) so Ring tracks
 * this as a single authorized device, not a new one on every restart.
 * Pass a machineId override for testing; defaults to os.hostname().
 */
export function generateHardwareId(machineId = hostname()): string {
  const raw = `${HARDWARE_ID_NAMESPACE}:${RING_USER_AGENT}:${machineId}`;
  const hash = createHash('sha1').update(raw).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '5' + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join('-');
}

export async function fetchToken(options: FetchTokenOptions): Promise<RingTokens> {
  const { email, password, hardwareId, on2FA, otpCode } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': RING_USER_AGENT,
    hardware_id: hardwareId,
    Authorization: `Basic ${btoa(`${RING_CLIENT_ID}:`)}`,
  };

  if (otpCode) {
    headers['2fa-support'] = 'true';
    headers['2fa-code'] = otpCode;  // must remain string — OTPs can have leading zeros
  }

  const body = new URLSearchParams({
    client_id: RING_CLIENT_ID,
    grant_type: 'password',
    username: email,
    password,
    scope: 'client',
    include_client_id: 'true',
  });

  const response = await fetch(RING_OAUTH_URL, { method: 'POST', headers, body });

  if (response.status === 412) {
    if (!on2FA) throw new Requires2FAError();
    const code = await on2FA();
    return fetchToken({ ...options, otpCode: code });
  }

  if (response.status === 401) throw new RingAuthError();
  if (!response.ok) throw new RingAuthError(`Unexpected status: ${response.status}`);

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return { ...data, hardware_id: hardwareId };
}

export async function refreshToken(options: {
  refreshTokenValue: string;
  hardwareId: string;
}): Promise<RingTokens> {
  const { refreshTokenValue, hardwareId } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': RING_USER_AGENT,
    hardware_id: hardwareId,
    Authorization: `Basic ${btoa(`${RING_CLIENT_ID}:`)}`,
  };

  const body = new URLSearchParams({
    client_id: RING_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshTokenValue,
  });

  const response = await fetch(RING_OAUTH_URL, { method: 'POST', headers, body });

  if (response.status === 401) throw new RingTokenExpiredError();
  if (!response.ok) throw new RingTokenExpiredError(`Refresh failed: ${response.status}`);

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return { ...data, hardware_id: hardwareId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @walt/ring-client test
```

Expected: PASS

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @walt/ring-client typecheck
git add packages/ring-client/src/auth.ts packages/ring-client/src/__tests__/auth.test.ts
git commit -m "feat(ring-client): add auth module with 2FA and token refresh"
```

---

## Task 5: Devices

**Files:**
- Create: `packages/ring-client/src/devices.ts`
- Create: `packages/ring-client/src/__tests__/devices.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/ring-client/src/__tests__/devices.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseRingDevices, groupDevicesByLocation, mergeLocationNames } from '../devices.js';

const mockDevicesResponse = {
  doorbots: [
    { id: '1', location_id: 'loc-a', description: { name: 'Front Door' } },
  ],
  authorized_doorbots: [
    { id: '2', location_id: 'loc-a', description: { name: 'Shared Bell' } },
  ],
  stickup_cams: [
    { id: '3', location_id: 'loc-b', description: { name: 'Backyard' } },
  ],
  chimes: [
    { id: '4', location_id: 'loc-a', description: { name: 'Chime 1' } },
  ],
  other: [
    { id: '5', location_id: 'loc-b', description: { name: 'Intercom' } },
  ],
};

describe('parseRingDevices', () => {
  it('flattens all device keys into RingDevice array', () => {
    const devices = parseRingDevices(mockDevicesResponse);
    expect(devices).toHaveLength(5);
  });

  it('maps doorbots and authorized_doorbots to kind=doorbell', () => {
    const devices = parseRingDevices(mockDevicesResponse);
    const doorbells = devices.filter(d => d.kind === 'doorbell');
    expect(doorbells).toHaveLength(2);
    expect(doorbells.map(d => d.id)).toContain('1');
    expect(doorbells.map(d => d.id)).toContain('2');
  });

  it('maps stickup_cams to kind=stickup_cam', () => {
    expect(parseRingDevices(mockDevicesResponse).find(d => d.id === '3')?.kind).toBe('stickup_cam');
  });

  it('maps chimes to kind=chime', () => {
    expect(parseRingDevices(mockDevicesResponse).find(d => d.id === '4')?.kind).toBe('chime');
  });

  it('maps unknown keys to kind=other', () => {
    expect(parseRingDevices(mockDevicesResponse).find(d => d.id === '5')?.kind).toBe('other');
  });
});

describe('groupDevicesByLocation', () => {
  it('groups devices by locationId', () => {
    const devices = parseRingDevices(mockDevicesResponse);
    const locations = groupDevicesByLocation(devices);
    expect(locations).toHaveLength(2);
    expect(locations.find(l => l.id === 'loc-a')?.devices).toHaveLength(3);
  });
});

describe('mergeLocationNames', () => {
  it('merges location names from Ring locations API response', () => {
    const devices = parseRingDevices(mockDevicesResponse);
    const groups = groupDevicesByLocation(devices);
    const names = [
      { location_id: 'loc-a', name: 'Beach House' },
      { location_id: 'loc-b', name: 'City Flat' },
    ];
    const merged = mergeLocationNames(groups, names);
    expect(merged.find(l => l.id === 'loc-a')?.name).toBe('Beach House');
    expect(merged.find(l => l.id === 'loc-b')?.name).toBe('City Flat');
  });

  it('falls back to location ID as name when no match found', () => {
    const devices = parseRingDevices(mockDevicesResponse);
    const groups = groupDevicesByLocation(devices);
    const merged = mergeLocationNames(groups, []);
    expect(merged.find(l => l.id === 'loc-a')?.name).toBe('loc-a');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @walt/ring-client test
```

Expected: FAIL

- [ ] **Step 3: Implement `packages/ring-client/src/devices.ts`**

```typescript
export type DeviceKind = 'doorbell' | 'stickup_cam' | 'chime' | 'other';

export interface RingDevice {
  id: string;
  locationId: string;  // Ring location IDs are numeric strings — do NOT coerce to number
  kind: DeviceKind;
  description: string;
}

export interface RingLocation {
  id: string;
  name: string;
  devices: RingDevice[];
}

type RawDevice = {
  id: string | number;
  location_id: string | number;
  description?: { name?: string } | string;
};

export type RingDevicesResponse = Record<string, RawDevice[]>;

export interface RawLocationEntry {
  location_id: string;
  name: string;
}

const KIND_MAP: Record<string, DeviceKind> = {
  doorbots: 'doorbell',
  authorized_doorbots: 'doorbell',
  stickup_cams: 'stickup_cam',
  chimes: 'chime',
};

function getDescription(raw: RawDevice): string {
  if (typeof raw.description === 'string') return raw.description;
  return raw.description?.name ?? String(raw.id);
}

export function parseRingDevices(response: RingDevicesResponse): RingDevice[] {
  const devices: RingDevice[] = [];
  for (const [key, items] of Object.entries(response)) {
    if (!Array.isArray(items)) continue;
    const kind: DeviceKind = KIND_MAP[key] ?? 'other';
    for (const item of items) {
      devices.push({
        id: String(item.id),
        locationId: String(item.location_id),
        kind,
        description: getDescription(item),
      });
    }
  }
  return devices;
}

export function groupDevicesByLocation(devices: RingDevice[]): Array<Omit<RingLocation, 'name'>> {
  const map = new Map<string, RingDevice[]>();
  for (const device of devices) {
    const existing = map.get(device.locationId) ?? [];
    existing.push(device);
    map.set(device.locationId, existing);
  }
  return Array.from(map.entries()).map(([id, devs]) => ({ id, devices: devs }));
}

export function mergeLocationNames(
  groups: Array<Omit<RingLocation, 'name'>>,
  locationNames: RawLocationEntry[]
): RingLocation[] {
  const nameMap = new Map(locationNames.map(l => [l.location_id, l.name]));
  return groups.map(g => ({
    ...g,
    name: nameMap.get(g.id) ?? g.id,  // fall back to ID if no name found
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @walt/ring-client test
```

Expected: PASS

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @walt/ring-client typecheck
git add packages/ring-client/src/devices.ts packages/ring-client/src/__tests__/devices.test.ts
git commit -m "feat(ring-client): add device parsing, location grouping, and name merging"
```

---

## Task 6: Events and deduplication

**Files:**
- Create: `packages/ring-client/src/events.ts`
- Create: `packages/ring-client/src/__tests__/events.test.ts`

- [ ] **Step 1: Create `packages/ring-client/src/events.ts`**

```typescript
import { DEDUP_MAX_SIZE } from './const.js';

export type EventKind = 'ding' | 'motion' | 'intercom_unlock';

export interface RingEvent {
  id: string;
  deviceId: string;
  locationId: string;
  kind: EventKind;
  timestamp: Date;
  answered?: boolean;  // absent for motion events
}

export type EventCallback = (event: RingEvent) => void;
export type ErrorCallback = (error: Error) => void;

/**
 * Bounded deduplication tracker.
 * Tracks up to DEDUP_MAX_SIZE event IDs. When full, evicts oldest before inserting.
 * Resets on process restart — events received while the process was down will
 * re-emit on the first poll after restart (acceptable for this use case).
 */
export class EventDeduplicator {
  private seen = new Map<string, Date>();

  /** Returns true if the event is new and should be emitted. Registers the ID. */
  isNew(eventId: string): boolean {
    if (this.seen.has(eventId)) return false;
    if (this.seen.size >= DEDUP_MAX_SIZE) {
      const oldestKey = this.seen.keys().next().value;
      if (oldestKey !== undefined) this.seen.delete(oldestKey);
    }
    this.seen.set(eventId, new Date());
    return true;
  }

  clear(): void {
    this.seen.clear();
  }
}
```

- [ ] **Step 2: Write and run tests**

Create `packages/ring-client/src/__tests__/events.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EventDeduplicator } from '../events.js';

describe('EventDeduplicator', () => {
  it('returns true for new event IDs', () => {
    const dedup = new EventDeduplicator();
    expect(dedup.isNew('evt-1')).toBe(true);
  });

  it('returns false for duplicate event IDs', () => {
    const dedup = new EventDeduplicator();
    dedup.isNew('evt-1');
    expect(dedup.isNew('evt-1')).toBe(false);
  });

  it('evicts oldest entry when at capacity and treats evicted ID as new', () => {
    const dedup = new EventDeduplicator();
    for (let i = 0; i < 1000; i++) {
      dedup.isNew(`evt-${i}`);
    }
    // Adding one more evicts evt-0
    dedup.isNew('evt-new');
    // evt-0 was evicted, so it should be treated as new again
    expect(dedup.isNew('evt-0')).toBe(true);
    // evt-1 was not evicted yet
    expect(dedup.isNew('evt-1')).toBe(false);
  });
});
```

```bash
pnpm --filter @walt/ring-client test
```

Expected: PASS

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @walt/ring-client typecheck
git add packages/ring-client/src/events.ts packages/ring-client/src/__tests__/events.test.ts
git commit -m "feat(ring-client): add event types and bounded deduplicator"
```

---

## Task 7: Polling

**Files:**
- Create: `packages/ring-client/src/poller.ts`
- Create: `packages/ring-client/src/__tests__/poller.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/ring-client/src/__tests__/poller.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPoller } from '../poller.js';
import { EventDeduplicator } from '../events.js';
import type { RingDevice } from '../devices.js';

const mockDevice: RingDevice = {
  id: 'dev-1',
  locationId: 'loc-1',
  kind: 'doorbell',
  description: 'Front Door',
};

describe('createPoller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits new events from history', async () => {
    const mockGet = vi.fn().mockResolvedValue([
      { id: 'evt-1', kind: 'ding', created_at: '2026-01-01T10:00:00Z', answered: true },
    ]);
    const onEvent = vi.fn();

    const poller = createPoller({
      devices: [mockDevice],
      get: mockGet,
      dedup: new EventDeduplicator(),
      onEvent,
    });
    await poller.poll();

    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      id: 'evt-1',
      kind: 'ding',
      deviceId: 'dev-1',
      locationId: 'loc-1',
      answered: true,
    }));
  });

  it('does not emit duplicate events across polls', async () => {
    const mockGet = vi.fn().mockResolvedValue([
      { id: 'evt-1', kind: 'ding', created_at: '2026-01-01T10:00:00Z' },
    ]);
    const onEvent = vi.fn();

    const poller = createPoller({
      devices: [mockDevice],
      get: mockGet,
      dedup: new EventDeduplicator(),
      onEvent,
    });
    await poller.poll();
    await poller.poll();

    expect(onEvent).toHaveBeenCalledOnce();
  });

  it('does not poll after stop() is called', async () => {
    const mockGet = vi.fn().mockResolvedValue([]);
    const poller = createPoller({
      devices: [mockDevice],
      get: mockGet,
      dedup: new EventDeduplicator(),
      onEvent: vi.fn(),
    });

    poller.start();
    poller.stop();

    await vi.runAllTimersAsync();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @walt/ring-client test
```

Expected: FAIL

- [ ] **Step 3: Implement `packages/ring-client/src/poller.ts`**

```typescript
import { POLL_INTERVAL_MS } from './const.js';
import type { EventCallback, EventDeduplicator, RingEvent } from './events.js';
import type { RingDevice } from './devices.js';
import type { HttpClient } from './http.js';

interface RawHistoryEntry {
  id: string | number;
  kind?: string;
  created_at?: string;
  answered?: boolean;
}

interface PollerOptions {
  devices: RingDevice[];
  get: HttpClient['get'];
  dedup: EventDeduplicator;
  onEvent: EventCallback;
}

export interface Poller {
  poll: () => Promise<void>;
  start: () => void;
  stop: () => void;
}

function normalizeKind(kind: string | undefined): RingEvent['kind'] {
  if (kind === 'motion') return 'motion';
  if (kind === 'intercom_unlock') return 'intercom_unlock';
  return 'ding';
}

export function createPoller(options: PollerOptions): Poller {
  const { devices, get, dedup, onEvent } = options;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function poll(): Promise<void> {
    for (const device of devices) {
      try {
        const history = await get<RawHistoryEntry[]>('/doorbots/history', {
          doorbot_id: device.id,
          limit: '10',
        });

        for (const entry of history) {
          const id = String(entry.id);
          if (!dedup.isNew(id)) continue;

          const event: RingEvent = {
            id,
            deviceId: device.id,
            locationId: device.locationId,
            kind: normalizeKind(entry.kind),
            timestamp: entry.created_at ? new Date(entry.created_at) : new Date(),
            ...(entry.answered !== undefined ? { answered: entry.answered } : {}),
          };

          onEvent(event);
        }
      } catch {
        // Silently skip failed device — don't crash the whole loop
      }
    }
  }

  return {
    poll,
    start() {
      timer = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @walt/ring-client test
```

Expected: PASS

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @walt/ring-client typecheck
git add packages/ring-client/src/poller.ts packages/ring-client/src/__tests__/poller.test.ts
git commit -m "feat(ring-client): add polling loop with deduplication"
```

---

## Task 8: FCM listener

**Files:**
- Create: `packages/ring-client/src/fcm.ts`
- Create: `packages/ring-client/src/__tests__/fcm.test.ts`

`createFcmListener` accepts an optional `createReceiver` factory so tests can inject a mock without dynamic import mocking (which doesn't intercept `import()` calls reliably in Vitest). The real factory uses `@eneris/push-receiver`.

> **Important:** If `@eneris/push-receiver` fails to register at runtime, the listener sets status to `'degraded'` and the poller handles all events. Always check `client.getStatus().fcm` on startup.

- [ ] **Step 1: Write failing tests**

Create `packages/ring-client/src/__tests__/fcm.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createFcmListener } from '../fcm.js';
import { EventDeduplicator } from '../events.js';

describe('createFcmListener', () => {
  it('sets status to degraded when receiver factory throws', async () => {
    const listener = createFcmListener({
      accessToken: 'tok',
      hardwareId: 'hw',
      onEvent: vi.fn(),
      dedup: new EventDeduplicator(),
      createReceiver: () => { throw new Error('FCM unavailable'); },
    });

    await listener.start();
    expect(listener.getStatus()).toBe('degraded');
  });

  it('sets status to connected when receiver registers successfully', async () => {
    const mockToken = 'fcm-token-123';
    const mockReceiver = {
      getToken: vi.fn().mockResolvedValue(mockToken),
      onNotification: vi.fn(),
      destroy: vi.fn(),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{}', { status: 200 })
    ));

    const listener = createFcmListener({
      accessToken: 'tok',
      hardwareId: 'hw',
      onEvent: vi.fn(),
      dedup: new EventDeduplicator(),
      createReceiver: () => mockReceiver,
    });

    await listener.start();
    expect(listener.getStatus()).toBe('connected');
    expect(mockReceiver.getToken).toHaveBeenCalled();
  });

  it('emits parsed ding event from FCM notification', async () => {
    const onEvent = vi.fn();
    let capturedCallback: ((notification: unknown) => void) | null = null;

    const mockReceiver = {
      getToken: vi.fn().mockResolvedValue('fcm-token'),
      onNotification: vi.fn((cb: (n: unknown) => void) => { capturedCallback = cb; }),
      destroy: vi.fn(),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

    const listener = createFcmListener({
      accessToken: 'tok',
      hardwareId: 'hw',
      onEvent,
      dedup: new EventDeduplicator(),
      createReceiver: () => mockReceiver,
    });

    await listener.start();

    // Simulate incoming FCM message
    capturedCallback?.({
      data: {
        ding: { id: 'evt-99', kind: 'ding', created_at: '2026-01-01T10:00:00Z', doorbot_id: 'dev-1' },
        device: { id: 'dev-1', location_id: 'loc-1' },
      },
    });

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      id: 'evt-99',
      kind: 'ding',
      deviceId: 'dev-1',
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @walt/ring-client test
```

Expected: FAIL

- [ ] **Step 3: Implement `packages/ring-client/src/fcm.ts`**

```typescript
import { RING_API_BASE, FCM_SENDER_ID, FCM_APP_ID, FCM_PROJECT_ID, FCM_API_KEY } from './const.js';
import type { EventCallback, EventDeduplicator, RingEvent } from './events.js';

export type FcmStatus = 'connected' | 'degraded' | 'stopped';

interface FcmReceiver {
  getToken: () => Promise<string>;
  onNotification: (callback: (notification: FcmNotification) => void) => void;
  destroy?: () => void;
}

interface FcmNotification {
  data?: FcmPushData;
}

interface FcmPushData {
  ding?: {
    id?: string;
    kind?: string;
    created_at?: string;
    answered?: boolean;
    doorbot_id?: string;
  };
  device?: { id?: string; location_id?: string };
  action?: string;
}

interface FcmListenerOptions {
  accessToken: string;
  hardwareId: string;
  onEvent: EventCallback;
  dedup: EventDeduplicator;
  /** Injectable factory for testing. Defaults to creating a real PushReceiver. */
  createReceiver?: () => FcmReceiver | Promise<FcmReceiver>;
}

export interface FcmListener {
  start: () => Promise<void>;
  stop: () => void;
  getStatus: () => FcmStatus;
}

async function defaultCreateReceiver(): Promise<FcmReceiver> {
  const { PushReceiver } = await import('@eneris/push-receiver');
  return new PushReceiver({
    senderId: FCM_SENDER_ID,
    appId: FCM_APP_ID,
    projectId: FCM_PROJECT_ID,
    apiKey: FCM_API_KEY,
  }) as FcmReceiver;
}

function parseEvent(data: FcmPushData, dedup: EventDeduplicator): RingEvent | null {
  const ding = data.ding;
  if (!ding?.id) return null;
  const id = String(ding.id);
  if (!dedup.isNew(id)) return null;

  const kind: RingEvent['kind'] =
    ding.kind === 'motion' ? 'motion'
    : data.action === 'intercom_unlock' ? 'intercom_unlock'
    : 'ding';

  return {
    id,
    deviceId: String(ding.doorbot_id ?? data.device?.id ?? ''),
    locationId: String(data.device?.location_id ?? ''),
    kind,
    timestamp: ding.created_at ? new Date(ding.created_at) : new Date(),
    ...(ding.answered !== undefined ? { answered: ding.answered } : {}),
  };
}

export function createFcmListener(options: FcmListenerOptions): FcmListener {
  const { accessToken, hardwareId, onEvent, dedup, createReceiver } = options;
  let status: FcmStatus = 'stopped';
  let receiver: FcmReceiver | null = null;

  return {
    async start() {
      try {
        receiver = await (createReceiver ?? defaultCreateReceiver)();
        const fcmToken = await receiver.getToken();

        // Register FCM token with Ring
        await fetch(`${RING_API_BASE}/device`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            hardware_id: hardwareId,
          },
          body: JSON.stringify({
            device: {
              metadata: {
                api_version: '11',
                device_model: 'ring-client-node',
                pn_service: 'fcm',
                pn_token: fcmToken,
              },
            },
          }),
        });

        receiver.onNotification((notification) => {
          if (!notification.data) return;
          const event = parseEvent(notification.data, dedup);
          if (event) onEvent(event);
        });

        status = 'connected';
      } catch {
        // Degrade gracefully — poller continues as sole event source
        status = 'degraded';
      }
    },

    stop() {
      receiver?.destroy?.();
      receiver = null;
      status = 'stopped';
    },

    getStatus() {
      return status;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @walt/ring-client test
```

Expected: PASS

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @walt/ring-client typecheck
git add packages/ring-client/src/fcm.ts packages/ring-client/src/__tests__/fcm.test.ts
git commit -m "feat(ring-client): add FCM listener with factory injection and graceful degradation"
```

---

## Task 9: RingClient

**Files:**
- Create: `packages/ring-client/src/client.ts`
- Create: `packages/ring-client/src/__tests__/client.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/ring-client/src/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { RingClient } from '../client.js';

describe('RingClient', () => {
  it('calls onTokenUpdate after successful auth', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        access_token: 'acc',
        refresh_token: 'ref',
        expires_in: 3600,
      }), { status: 200 })
    ));

    const onTokenUpdate = vi.fn();
    const client = new RingClient({ email: 'a@b.com', password: 'pw', onTokenUpdate });
    await client.auth({});

    expect(onTokenUpdate).toHaveBeenCalledWith(expect.objectContaining({
      access_token: 'acc',
      hardware_id: expect.any(String),
    }));
  });

  it('skips fetch when savedTokens provided', async () => {
    const fetchSpy = vi.stubGlobal('fetch', vi.fn());
    const client = new RingClient({
      email: 'a@b.com',
      password: 'pw',
      savedTokens: {
        access_token: 'saved',
        refresh_token: 'ref',
        expires_in: 3600,
        hardware_id: 'hw-123',
      },
    });
    await client.auth({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('getStatus returns not_started before startListening', () => {
    const client = new RingClient({ email: 'a@b.com', password: 'pw' });
    const status = client.getStatus();
    expect(status.fcm).toBe('not_started');
    expect(status.polling).toBe('stopped');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @walt/ring-client test
```

Expected: FAIL

- [ ] **Step 3: Implement `packages/ring-client/src/client.ts`**

```typescript
import { generateHardwareId, fetchToken, refreshToken, type RingTokens } from './auth.js';
import { createHttpClient, type HttpClient } from './http.js';
import {
  parseRingDevices,
  groupDevicesByLocation,
  mergeLocationNames,
  type RingLocation,
  type RingDevicesResponse,
  type RawLocationEntry,
} from './devices.js';
import { EventDeduplicator, type EventCallback, type ErrorCallback } from './events.js';
import { createPoller, type Poller } from './poller.js';
import { createFcmListener, type FcmListener, type FcmStatus } from './fcm.js';

export interface RingClientOptions {
  email: string;
  password: string;
  savedTokens?: RingTokens;
  onTokenUpdate?: (tokens: RingTokens) => void;
}

export interface ClientStatus {
  fcm: FcmStatus | 'not_started';
  polling: 'active' | 'stopped';
}

export class RingClient {
  private tokens: RingTokens | null;
  private readonly options: RingClientOptions;
  private eventCallbacks: EventCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private poller: Poller | null = null;
  private fcmListener: FcmListener | null = null;
  private pollingActive = false;

  constructor(options: RingClientOptions) {
    this.options = options;
    this.tokens = options.savedTokens ?? null;
  }

  async auth(opts: { on2FA?: () => Promise<string> }): Promise<void> {
    if (this.tokens) return;

    const hardwareId = generateHardwareId();
    this.tokens = await fetchToken({
      email: this.options.email,
      password: this.options.password,
      hardwareId,
      on2FA: opts.on2FA,
    });

    this.options.onTokenUpdate?.(this.tokens);
  }

  private getHttp(): HttpClient {
    if (!this.tokens) throw new Error('Call auth() before using the client');
    const self = this;

    return createHttpClient({
      getTokens: async () => ({
        accessToken: self.tokens!.access_token,
        hardwareId: self.tokens!.hardware_id,
      }),
      onTokenRefresh: async () => {
        const current = self.tokens!;
        const newTokens = await refreshToken({
          refreshTokenValue: current.refresh_token,
          hardwareId: current.hardware_id,
        });
        self.tokens = newTokens;
        self.options.onTokenUpdate?.(newTokens);
      },
    });
  }

  async getLocations(): Promise<RingLocation[]> {
    const http = this.getHttp();
    const [devicesResponse, locationsResponse] = await Promise.all([
      http.get<RingDevicesResponse>('/ring_devices'),
      http.get<{ user_locations: RawLocationEntry[] }>('/locations').catch(() => ({ user_locations: [] })),
    ]);

    const devices = parseRingDevices(devicesResponse);
    const groups = groupDevicesByLocation(devices);
    return mergeLocationNames(groups, locationsResponse.user_locations);
  }

  async getHistory(deviceId: string, opts: { limit?: number } = {}): Promise<unknown[]> {
    const http = this.getHttp();
    return http.get<unknown[]>('/doorbots/history', {
      doorbot_id: deviceId,
      limit: String(opts.limit ?? 20),
    });
  }

  async getSnapshot(deviceId: string): Promise<Buffer> {
    if (!this.tokens) throw new Error('Call auth() before using the client');
    const http = this.getHttp();
    // Use the http client (handles 401 refresh) via a raw path on the same base
    const response = await fetch(
      `https://api.ring.com/clients_api/snapshots/image/${deviceId}`,
      {
        headers: {
          Authorization: `Bearer ${this.tokens.access_token}`,
          hardware_id: this.tokens.hardware_id,
        },
      }
    );
    if (!response.ok) throw new Error(`Snapshot fetch failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  onEvent(callback: EventCallback): void {
    this.eventCallbacks.push(callback);
  }

  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  private emit(event: Parameters<EventCallback>[0]): void {
    for (const cb of this.eventCallbacks) cb(event);
  }

  async startListening(): Promise<void> {
    if (!this.tokens) throw new Error('Call auth() before startListening()');

    const locations = await this.getLocations();
    const devices = locations.flatMap(l => l.devices);
    const http = this.getHttp();
    const dedup = new EventDeduplicator();

    this.poller = createPoller({
      devices,
      get: http.get.bind(http),
      dedup,
      onEvent: this.emit.bind(this),
    });

    this.fcmListener = createFcmListener({
      accessToken: this.tokens.access_token,
      hardwareId: this.tokens.hardware_id,
      onEvent: this.emit.bind(this),
      dedup,
    });

    await this.fcmListener.start();
    this.poller.start();
    this.pollingActive = true;
  }

  async disconnect(): Promise<void> {
    this.poller?.stop();
    this.fcmListener?.stop();
    this.pollingActive = false;
  }

  getStatus(): ClientStatus {
    return {
      fcm: this.fcmListener?.getStatus() ?? 'not_started',
      polling: this.pollingActive ? 'active' : 'stopped',
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @walt/ring-client test
```

Expected: PASS

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @walt/ring-client typecheck
git add packages/ring-client/src/client.ts packages/ring-client/src/__tests__/client.test.ts
git commit -m "feat(ring-client): add RingClient main class"
```

---

## Task 10: Public exports and monorepo wiring

**Files:**
- Modify: `packages/ring-client/src/index.ts`

- [ ] **Step 1: Update `packages/ring-client/src/index.ts`**

```typescript
export { RingClient } from './client.js';
export type { RingClientOptions, ClientStatus } from './client.js';
export type { RingLocation, RingDevice, DeviceKind } from './devices.js';
export type { RingEvent, EventKind, EventCallback, ErrorCallback } from './events.js';
export type { RingTokens } from './auth.js';
export {
  RingAuthError,
  Requires2FAError,
  RingTokenExpiredError,
  RingNetworkError,
} from './errors.js';
```

- [ ] **Step 2: Run full test suite, typecheck, lint, and build**

```bash
pnpm --filter @walt/ring-client test
pnpm --filter @walt/ring-client typecheck
pnpm --filter @walt/ring-client lint
pnpm --filter @walt/ring-client build
```

Expected: all PASS. `packages/ring-client/dist/` generated with `.js`, `.d.ts`, `.d.ts.map` files, with `dist/index.js` as the entry point.

- [ ] **Step 3: Verify turbo can build the package**

```bash
pnpm turbo run build --filter=@walt/ring-client
```

Expected: PASS (no turbo.json changes needed — all `packages/*` are already in the workspace)

- [ ] **Step 4: Commit**

```bash
git add packages/ring-client/src/index.ts
git commit -m "feat(ring-client): wire public exports and confirm monorepo integration"
```

---

## Done

- [ ] All tests pass: `pnpm --filter @walt/ring-client test`
- [ ] Typecheck passes: `pnpm --filter @walt/ring-client typecheck`
- [ ] Lint passes: `pnpm --filter @walt/ring-client lint`
- [ ] Build succeeds: `pnpm --filter @walt/ring-client build`
- [ ] `RingClient` can be imported from `@walt/ring-client` in another package

**Manual integration test (not in CI — requires real Ring credentials):**

```typescript
// scripts/test-ring.ts
import { RingClient } from '@walt/ring-client';

const client = new RingClient({
  email: process.env['RING_EMAIL']!,
  password: process.env['RING_PASSWORD']!,
  onTokenUpdate: (tokens) => console.log('Tokens updated:', tokens.hardware_id),
});

await client.auth({ on2FA: async () => {
  // Enter the code Ring texts to your phone
  return new Promise(resolve => process.stdin.once('data', d => resolve(d.toString().trim())));
}});

const locations = await client.getLocations();
console.log(JSON.stringify(locations, null, 2));

client.onEvent(event => console.log('Event:', event));
console.log('Listening... check client.getStatus() for FCM state');
await client.startListening();
console.log('Status:', client.getStatus());
```

Run with: `RING_EMAIL=you@example.com RING_PASSWORD=secret pnpm tsx scripts/test-ring.ts`
