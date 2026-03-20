# Pool Temperature Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display live iAqualink pool temperatures on the `/today` dashboard, polled every 15 minutes by a cron job and persisted in the database.

**Architecture:** A TypeScript iAqualink client polls each property's device shadow endpoint; a cron handler stores readings in a new `pool_temperature_readings` DB table; a `getPoolTemperatures` helper (with dependency injection for testability) queries and returns the data; the `/today` server component renders a temperature card per pool property. Last known temperature is always shown even when the pump is off.

**Tech Stack:** Next.js App Router, Drizzle ORM (PostgreSQL), Node.js `fetch`, `node:test` for unit tests, Tailwind CSS.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `packages/db/src/schema.ts` | Add `iaqualinkDeviceSerial` to `properties`; add `poolTemperatureReadings` table |
| Create | `packages/db/drizzle/0013_pool_temperatures.sql` | Migration SQL |
| Modify | `packages/db/drizzle/meta/_journal.json` | Register migration |
| Create | `apps/web/src/lib/iaqualink.ts` | iAqualink API client (auth + readTemperature) |
| Create | `apps/web/src/lib/iaqualink.test.ts` | Unit tests for the client |
| Create | `apps/web/src/app/api/cron/poll-pool-temps/handler.ts` | Cron business logic |
| Create | `apps/web/src/app/api/cron/poll-pool-temps/route.ts` | Route file — POST export only |
| Create | `apps/web/src/app/api/cron/poll-pool-temps/handler.test.ts` | Unit tests for cron handler |
| Create | `apps/web/src/app/today/get-pool-temperatures.ts` | Data fetching helper with deps injection |
| Create | `apps/web/src/app/today/get-pool-temperatures.test.ts` | Unit tests for data fetching helper |
| Modify | `apps/web/src/app/today/page.tsx` | Import and call `getPoolTemperatures`; render pool section |

---

## Task 1: DB Schema + Migration

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0013_pool_temperatures.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`

- [ ] **Step 1: Add `iaqualinkDeviceSerial` to the existing `properties` table in `packages/db/src/schema.ts`**

Find the `properties` table definition (around line 64). Do NOT redeclare the table — add only this one line inside the existing definition, after `hasPool`:

```typescript
  iaqualinkDeviceSerial: text('iaqualink_device_serial'),
```

The table should now end like:

```typescript
  hasPool: boolean('has_pool').notNull().default(false),
  iaqualinkDeviceSerial: text('iaqualink_device_serial'), // ← new line
});
```

- [ ] **Step 2: Add the `poolTemperatureReadings` table to `packages/db/src/schema.ts`**

`index` is already imported at the top. Add this after the `taskReminders` table:

```typescript
export const poolTemperatureReadings = waltSchema.table(
  'pool_temperature_readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: text('property_id').notNull(),
    deviceSerial: text('device_serial').notNull(),
    temperatureF: integer('temperature_f'),
    polledAt: timestamp('polled_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    propertyPolledAtIdx: index('pool_temperature_readings_property_polled_at_idx').on(
      table.propertyId,
      table.polledAt,
    ),
  }),
);
```

- [ ] **Step 3: Create the migration SQL file**

Create `packages/db/drizzle/0013_pool_temperatures.sql`:

```sql
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "iaqualink_device_serial" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."pool_temperature_readings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" text NOT NULL,
  "device_serial" text NOT NULL,
  "temperature_f" integer,
  "polled_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pool_temperature_readings_property_polled_at_idx"
  ON "walt"."pool_temperature_readings" ("property_id", "polled_at" DESC);
```

- [ ] **Step 4: Register the migration in `packages/db/drizzle/meta/_journal.json`**

Add a new entry to the `entries` array after the idx 12 entry. Generate the `when` value by running `Date.now()` in a terminal (`node -e "console.log(Date.now())"`) and substituting the result:

```json
{
  "idx": 13,
  "version": "7",
  "when": <PASTE_DATE_NOW_RESULT_HERE>,
  "tag": "0013_pool_temperatures",
  "breakpoints": true
}
```

- [ ] **Step 5: Verify typecheck passes**

```bash
pnpm turbo run typecheck --filter=@walt/db
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/0013_pool_temperatures.sql packages/db/drizzle/meta/_journal.json
git commit -m "feat(db): add pool_temperature_readings table and iaqualink_device_serial column"
```

---

## Task 2: iAqualink TypeScript Client

**Files:**
- Create: `apps/web/src/lib/iaqualink.ts`
- Create: `apps/web/src/lib/iaqualink.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `apps/web/src/lib/iaqualink.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { readTemperature, clearTokenCache } from './iaqualink.js';

// Helper: creates a mock fetch that returns responses in sequence
function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  let i = 0;
  return async (_url: string, _init?: RequestInit): Promise<Response> => {
    const r = responses[i++] ?? { status: 200, body: {} };
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
    } as Response;
  };
}

test.beforeEach(() => clearTokenCache());

void test('returns temperature when pump is running', async () => {
  const fetchFn = mockFetch([
    { status: 200, body: { authentication_token: 'tok-1' } },
    { status: 200, body: { reported: { state: { pool_temp: 84 } } } },
  ]);
  const result = await readTemperature('device-123', { fetchFn });
  assert.equal(result.temperatureF, 84);
  assert.equal(result.deviceSerial, 'device-123');
  assert.ok(result.polledAt instanceof Date);
});

void test('returns null temperature when pump is off (pool_temp absent)', async () => {
  const fetchFn = mockFetch([
    { status: 200, body: { authentication_token: 'tok-1' } },
    { status: 200, body: { reported: { state: {} } } },
  ]);
  const result = await readTemperature('device-123', { fetchFn });
  assert.equal(result.temperatureF, null);
});

void test('re-authenticates on 401 and retries shadow request', async () => {
  let authCalls = 0;
  const responses: Array<{ status: number; body: unknown }> = [
    { status: 200, body: { authentication_token: 'tok-1' } },
    { status: 401, body: {} },
    { status: 200, body: { authentication_token: 'tok-2' } },
    { status: 200, body: { reported: { state: { pool_temp: 78 } } } },
  ];
  let i = 0;
  const fetchFn = async (url: string, init?: RequestInit): Promise<Response> => {
    if (url.includes('/login')) authCalls++;
    const r = responses[i++] ?? { status: 200, body: {} };
    return { ok: r.status < 300, status: r.status, json: async () => r.body } as Response;
  };
  const result = await readTemperature('device-abc', { fetchFn });
  assert.equal(authCalls, 2);
  assert.equal(result.temperatureF, 78);
});

void test('caches token — authenticates only once across multiple reads', async () => {
  let authCalls = 0;
  const fetchFn = async (url: string): Promise<Response> => {
    if (url.includes('/login')) {
      authCalls++;
      return { ok: true, status: 200, json: async () => ({ authentication_token: 'cached-tok' }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ reported: { state: { pool_temp: 80 } } }) } as Response;
  };
  await readTemperature('d1', { fetchFn });
  await readTemperature('d2', { fetchFn });
  assert.equal(authCalls, 1);
});
```

- [ ] **Step 2: Run tests to confirm they fail (module not found)**

```bash
cd apps/web && pnpm test -- --test-name-pattern "iaqualink" 2>&1 | head -20
```

Expected: error about missing module.

- [ ] **Step 3: Implement `apps/web/src/lib/iaqualink.ts`**

```typescript
const ZODIAC_BASE = 'https://prod.zodiac-io.com';
// Public API key shared by all iAqualink integrations — not a secret, hardcoded intentionally.
const IAQUALINK_API_KEY = 'EOOEMOW4YR6QNB07';

let cachedToken: string | null = null;

export interface PoolReading {
  deviceSerial: string;
  temperatureF: number | null; // null = pump off or temperature unavailable
  polledAt: Date;
}

async function authenticate(fetchFn: typeof fetch): Promise<string> {
  const res = await fetchFn(`${ZODIAC_BASE}/users/v1/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.IAQUALINK_USERNAME,
      password: process.env.IAQUALINK_PASSWORD,
      apiKey: IAQUALINK_API_KEY,
    }),
  });
  if (!res.ok) throw new Error(`iAqualink auth failed: ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  // The API returns the token under different field names depending on firmware version.
  const token =
    (data.authentication_token as string | undefined) ??
    (data.id_token as string | undefined) ??
    ((data.userPoolOAuth as Record<string, unknown> | undefined)?.id_token as string | undefined);
  if (!token) {
    throw new Error(`iAqualink auth: no token found. Response fields: ${Object.keys(data).join(', ')}`);
  }
  cachedToken = token;
  return token;
}

export async function readTemperature(
  deviceSerial: string,
  deps: { fetchFn?: typeof fetch } = {},
): Promise<PoolReading> {
  const fetchFn = deps.fetchFn ?? fetch;
  const token = cachedToken ?? (await authenticate(fetchFn));

  const doRequest = (authToken: string) =>
    fetchFn(`${ZODIAC_BASE}/devices/v2/${deviceSerial}/shadow`, {
      headers: { authorization: `Bearer ${authToken}` },
    });

  let res = await doRequest(token);
  if (res.status === 401) {
    cachedToken = null;
    const newToken = await authenticate(fetchFn);
    res = await doRequest(newToken);
  }
  if (!res.ok) throw new Error(`iAqualink shadow fetch failed: ${res.status}`);

  const body = (await res.json()) as Record<string, unknown>;

  // NOTE: Confirm the exact path by logging `body` on the first live call.
  // Known paths from reverse engineering:
  //   body.reported.state.pool_temp  (most common)
  //   body.reported.pool_temp        (older firmware)
  const reported = (body.reported ?? body) as Record<string, unknown>;
  const state = (reported.state ?? reported) as Record<string, unknown>;
  const rawTemp = state.pool_temp ?? reported.pool_temp;
  const temperatureF = typeof rawTemp === 'number' ? rawTemp : null;

  return { deviceSerial, temperatureF, polledAt: new Date() };
}

/** Clears the in-process token cache. Exposed for testing. */
export function clearTokenCache(): void {
  cachedToken = null;
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd apps/web && pnpm test -- --test-name-pattern "iaqualink"
```

Expected: 4 tests pass, 0 failures.

- [ ] **Step 5: Typecheck**

```bash
pnpm turbo run typecheck --filter=@walt/web
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/iaqualink.ts apps/web/src/lib/iaqualink.test.ts
git commit -m "feat(web): add iAqualink TypeScript client with token caching"
```

---

## Task 3: Poll Cron Handler

**Files:**
- Create: `apps/web/src/app/api/cron/poll-pool-temps/handler.ts`
- Create: `apps/web/src/app/api/cron/poll-pool-temps/route.ts`
- Create: `apps/web/src/app/api/cron/poll-pool-temps/handler.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/app/api/cron/poll-pool-temps/handler.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePollPoolTemps } from './handler.js';

const makeRequest = (secret = 'test-secret') =>
  new Request('http://localhost/api/cron/poll-pool-temps', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });

void test('returns 401 with wrong secret', async () => {
  const res = await handlePollPoolTemps(makeRequest('wrong'), { cronSecret: 'test-secret' });
  assert.equal(res.status, 401);
});

void test('polls each pool property and inserts a reading', async () => {
  const insertedRows: unknown[] = [];
  const res = await handlePollPoolTemps(makeRequest(), {
    cronSecret: 'test-secret',
    getPoolProperties: async () => [
      { id: 'prop-1', name: 'Palmera', iaqualinkDeviceSerial: 'SN-ABC' },
      { id: 'prop-2', name: 'Casa Bonita', iaqualinkDeviceSerial: 'SN-DEF' },
    ],
    readTemperature: async (serial) => ({ deviceSerial: serial, temperatureF: 82, polledAt: new Date() }),
    insertReading: async (row) => { insertedRows.push(row); },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; polled: number };
  assert.equal(body.polled, 2);
  assert.equal(insertedRows.length, 2);
});

void test('inserts null temperature when pump is off', async () => {
  const insertedRows: Array<{ temperatureF: number | null }> = [];
  await handlePollPoolTemps(makeRequest(), {
    cronSecret: 'test-secret',
    getPoolProperties: async () => [
      { id: 'prop-1', name: 'Palmera', iaqualinkDeviceSerial: 'SN-ABC' },
    ],
    readTemperature: async (serial) => ({ deviceSerial: serial, temperatureF: null, polledAt: new Date() }),
    insertReading: async (row) => { insertedRows.push(row as { temperatureF: number | null }); },
  });
  assert.equal(insertedRows[0]?.temperatureF, null);
});

void test('continues polling other properties when one throws', async () => {
  const insertedRows: unknown[] = [];
  const res = await handlePollPoolTemps(makeRequest(), {
    cronSecret: 'test-secret',
    getPoolProperties: async () => [
      { id: 'prop-1', name: 'Palmera', iaqualinkDeviceSerial: 'SN-ABC' },
      { id: 'prop-2', name: 'Casa Bonita', iaqualinkDeviceSerial: 'SN-DEF' },
    ],
    readTemperature: async (serial) => {
      if (serial === 'SN-ABC') throw new Error('API timeout');
      return { deviceSerial: serial, temperatureF: 78, polledAt: new Date() };
    },
    insertReading: async (row) => { insertedRows.push(row); },
  });
  const body = (await res.json()) as { ok: boolean; polled: number };
  assert.equal(body.polled, 1);
  assert.equal(insertedRows.length, 1);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/web && pnpm test -- --test-name-pattern "poll-pool-temps" 2>&1 | head -20
```

Expected: module not found error.

- [ ] **Step 3: Create `handler.ts`**

```typescript
import { NextResponse } from 'next/server';
import { isNotNull } from 'drizzle-orm';
import { properties, poolTemperatureReadings } from '@walt/db';
import type { PoolReading } from '@/lib/iaqualink';

type PooledProperty = {
  id: string;
  name: string;
  iaqualinkDeviceSerial: string;
};

type Deps = {
  cronSecret?: string;
  getPoolProperties?: () => Promise<PooledProperty[]>;
  readTemperature?: (serial: string) => Promise<PoolReading>;
  insertReading?: (row: {
    id: string;
    propertyId: string;
    deviceSerial: string;
    temperatureF: number | null;
    polledAt: Date;
  }) => Promise<void>;
};

export async function handlePollPoolTemps(request: Request, deps: Deps = {}) {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');

  const getPoolProperties =
    deps.getPoolProperties ??
    (async () => {
      const rows = await db
        .select({
          id: properties.id,
          name: properties.name,
          iaqualinkDeviceSerial: properties.iaqualinkDeviceSerial,
        })
        .from(properties)
        .where(isNotNull(properties.iaqualinkDeviceSerial));
      return rows as PooledProperty[];
    });

  const readTemperature =
    deps.readTemperature ??
    (async (serial: string) => {
      const { readTemperature: iaqRead } = await import('@/lib/iaqualink');
      return iaqRead(serial);
    });

  const insertReading =
    deps.insertReading ??
    (async (row) => {
      await db.insert(poolTemperatureReadings).values(row);
    });

  const poolProperties = await getPoolProperties();
  let polled = 0;

  for (const prop of poolProperties) {
    try {
      const reading = await readTemperature(prop.iaqualinkDeviceSerial);
      await insertReading({
        id: crypto.randomUUID(),
        propertyId: prop.id,
        deviceSerial: reading.deviceSerial,
        temperatureF: reading.temperatureF,
        polledAt: reading.polledAt,
      });
      console.log(
        `[poll-pool-temps] ${prop.name}: ${reading.temperatureF !== null ? `${reading.temperatureF}°F` : 'pump off'}`,
      );
      polled++;
    } catch (err) {
      console.error(`[poll-pool-temps] Error for ${prop.name} (${prop.iaqualinkDeviceSerial}):`, err);
    }
  }

  return NextResponse.json({ ok: true, polled });
}
```

- [ ] **Step 4: Create `route.ts`**

```typescript
import { handlePollPoolTemps } from './handler';
export const POST = (request: Request) => handlePollPoolTemps(request);
```

- [ ] **Step 5: Run tests and confirm they pass**

```bash
cd apps/web && pnpm test -- --test-name-pattern "poll-pool-temps"
```

Expected: 4 tests pass, 0 failures.

- [ ] **Step 6: Typecheck**

```bash
pnpm turbo run typecheck --filter=@walt/web
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/cron/poll-pool-temps/
git commit -m "feat(web): add poll-pool-temps cron handler"
```

---

## Task 4: Pool Temperature Data Helper

**Files:**
- Create: `apps/web/src/app/today/get-pool-temperatures.ts`
- Create: `apps/web/src/app/today/get-pool-temperatures.test.ts`

This extracts the dashboard data logic into a testable helper with dependency injection, following the same pattern as the cron handlers.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/app/today/get-pool-temperatures.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { getPoolTemperatures } from './get-pool-temperatures.js';

void test('returns empty array when no pool properties have readings', async () => {
  const result = await getPoolTemperatures('org-1', {
    executeLatestPolls: async () => [],
    executeLastKnown: async () => [],
  });
  assert.deepEqual(result, []);
});

void test('returns null temperatureF and null asOf when all readings are null (pump always off)', async () => {
  const polledAt = new Date('2026-03-19T12:00:00Z');
  const result = await getPoolTemperatures('org-1', {
    executeLatestPolls: async () => [
      { property_id: 'prop-1', property_name: 'Palmera', temperature_f: null, polled_at: polledAt },
    ],
    executeLastKnown: async () => [],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.temperatureF, null);
  assert.equal(result[0]?.asOf, null);
  assert.equal(result[0]?.pumpRunning, false);
});

void test('shows last known temp with asOf when pump is currently off', async () => {
  const lastGoodTime = new Date('2026-03-19T10:00:00Z');
  const latestPollTime = new Date('2026-03-19T13:00:00Z');
  const result = await getPoolTemperatures('org-1', {
    executeLatestPolls: async () => [
      { property_id: 'prop-1', property_name: 'Palmera', temperature_f: null, polled_at: latestPollTime },
    ],
    executeLastKnown: async () => [
      { property_id: 'prop-1', temperature_f: 84, polled_at: lastGoodTime },
    ],
  });
  assert.equal(result[0]?.temperatureF, 84);
  assert.equal(result[0]?.pumpRunning, false);
  assert.deepEqual(result[0]?.asOf, lastGoodTime);
});

void test('shows current temp and pumpRunning=true when pump is on', async () => {
  const now = new Date('2026-03-19T13:00:00Z');
  const result = await getPoolTemperatures('org-1', {
    executeLatestPolls: async () => [
      { property_id: 'prop-1', property_name: 'Casa Bonita', temperature_f: 82, polled_at: now },
    ],
    executeLastKnown: async () => [
      { property_id: 'prop-1', temperature_f: 82, polled_at: now },
    ],
  });
  assert.equal(result[0]?.temperatureF, 82);
  assert.equal(result[0]?.pumpRunning, true);
  assert.deepEqual(result[0]?.asOf, now);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/web && pnpm test -- --test-name-pattern "get-pool-temperatures" 2>&1 | head -20
```

Expected: module not found.

- [ ] **Step 3: Create `get-pool-temperatures.ts`**

```typescript
import { sql } from 'drizzle-orm';

export type PoolTempRow = {
  propertyId: string;
  propertyName: string;
  pumpRunning: boolean;
  temperatureF: number | null;
  asOf: Date | null;
};

type RawPoll = {
  property_id: string;
  property_name: string;
  temperature_f: number | null;
  polled_at: Date;
};

type RawKnown = {
  property_id: string;
  temperature_f: number;
  polled_at: Date;
};

type Deps = {
  executeLatestPolls?: (orgId: string) => Promise<RawPoll[]>;
  executeLastKnown?: (orgId: string) => Promise<RawKnown[]>;
};

export async function getPoolTemperatures(orgId: string, deps: Deps = {}): Promise<PoolTempRow[]> {
  const { db } = await import('@/lib/db');

  const executeLatestPolls =
    deps.executeLatestPolls ??
    (async (id: string) => {
      const result = await db.execute(sql`
        SELECT DISTINCT ON (r.property_id)
          r.property_id,
          r.temperature_f,
          r.polled_at,
          p.name AS property_name
        FROM walt.pool_temperature_readings r
        JOIN walt.properties p ON p.id = r.property_id
        WHERE EXISTS (
          SELECT 1 FROM walt.property_access pa
          WHERE pa.property_id = r.property_id
            AND pa.organization_id = ${id}
        )
          AND p.iaqualink_device_serial IS NOT NULL
        ORDER BY r.property_id, r.polled_at DESC
      `);
      return result.rows as RawPoll[];
    });

  const executeLastKnown =
    deps.executeLastKnown ??
    (async (id: string) => {
      const result = await db.execute(sql`
        SELECT DISTINCT ON (r.property_id)
          r.property_id,
          r.temperature_f,
          r.polled_at
        FROM walt.pool_temperature_readings r
        WHERE EXISTS (
          SELECT 1 FROM walt.property_access pa
          WHERE pa.property_id = r.property_id
            AND pa.organization_id = ${id}
        )
          AND r.temperature_f IS NOT NULL
        ORDER BY r.property_id, r.polled_at DESC
      `);
      return result.rows as RawKnown[];
    });

  const latestPolls = await executeLatestPolls(orgId);
  const lastKnown = await executeLastKnown(orgId);

  const knownMap = new Map<string, RawKnown>();
  for (const row of lastKnown) {
    knownMap.set(row.property_id, row);
  }

  return latestPolls.map((poll) => {
    const known = knownMap.get(poll.property_id);
    return {
      propertyId: poll.property_id,
      propertyName: poll.property_name,
      pumpRunning: poll.temperature_f !== null,
      temperatureF: known?.temperature_f ?? null,
      asOf: known?.polled_at ?? null,
    };
  });
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd apps/web && pnpm test -- --test-name-pattern "get-pool-temperatures"
```

Expected: 4 tests pass, 0 failures.

- [ ] **Step 5: Typecheck**

```bash
pnpm turbo run typecheck --filter=@walt/web
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/today/get-pool-temperatures.ts apps/web/src/app/today/get-pool-temperatures.test.ts
git commit -m "feat(web): add getPoolTemperatures data helper with unit tests"
```

---

## Task 5: Dashboard Display

**Files:**
- Modify: `apps/web/src/app/today/page.tsx`

- [ ] **Step 1: Add import for `getPoolTemperatures` at the top of `page.tsx`**

Add this import alongside the existing imports (do not add a second `import { sql }` line — `sql` is already imported from `drizzle-orm`):

```typescript
import { getPoolTemperatures } from './get-pool-temperatures';
```

- [ ] **Step 2: Add `getPoolTemperatures` to the parallel data fetch in `TodayPage`**

Update the `Promise.all` call:

```typescript
const [turnovers, tasks, poolTemps] = await Promise.all([
  getTurnovers(auth.orgId),
  getTasksFromGateway(auth.orgId),
  getPoolTemperatures(auth.orgId),
]);
```

- [ ] **Step 3: Add the Pool Temperatures section to the JSX**

Insert this block after the summary chips row and before `<section id="turnovers">`:

```tsx
{poolTemps.length > 0 && (
  <section>
    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
      Pool Temperatures
    </h2>
    <div className="flex gap-3 overflow-x-auto pb-1">
      {poolTemps.map((pool) => (
        <div
          key={pool.propertyId}
          className="rounded-lg border border-gray-200 bg-white p-4 min-w-[160px] shrink-0"
        >
          <div className="text-sm font-medium text-gray-900 truncate">{pool.propertyName}</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">
            {pool.temperatureF !== null ? `${pool.temperatureF}°F` : '—'}
          </div>
          {pool.asOf && (
            <div className="text-xs text-gray-400 mt-1">
              as of{' '}
              {new Date(pool.asOf).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: 'America/Chicago',
              })}
            </div>
          )}
          {!pool.pumpRunning && (
            <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              Pump off
            </span>
          )}
        </div>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 4: Typecheck, lint, and build**

```bash
pnpm turbo run typecheck lint build --filter=@walt/web
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/today/page.tsx
git commit -m "feat(web): display pool temperatures on Today dashboard"
```

---

## Task 6: Server Setup — Environment Variables, Migration, and Cron

This task is done on the AWS Lightsail server (`ssh -i ~/.ssh/hostpilot-app.pem ubuntu@54.210.5.114`).

- [ ] **Step 1: Add iAqualink credentials to `/opt/walt/.env.production`**

```bash
echo 'IAQUALINK_USERNAME=your-iaqualink-email@example.com' >> /opt/walt/.env.production
echo 'IAQUALINK_PASSWORD=your-iaqualink-password' >> /opt/walt/.env.production
```

Replace with real credentials.

- [ ] **Step 2: Run the migration on the production database**

```bash
cd /opt/walt && docker compose exec web pnpm --filter=@walt/db migrate
```

Expected: migration `0013_pool_temperatures` applied.

- [ ] **Step 3: Restart the web container to pick up new env vars**

```bash
cd /opt/walt && docker compose restart web
```

- [ ] **Step 4: Add the poll cron to the system crontab**

The crontab already has `CRON_SECRET=...` defined at the top — do not add it again. Run `crontab -e` and add only the new curl line:

```
*/15 * * * * curl -s -X POST https://ai.walt-services.com/api/cron/poll-pool-temps -H "Authorization: Bearer $CRON_SECRET" >> /var/log/walt-cron.log 2>&1
```

- [ ] **Step 5: Set `iaqualink_device_serial` for each pool property in the DB**

Find device serials by triggering a test call and logging the iAqualink devices response, or by checking the iAqualink app. Then connect to the DB and run (one `UPDATE` per property):

```sql
UPDATE walt.properties
SET iaqualink_device_serial = 'YOUR_DEVICE_SERIAL_HERE'
WHERE id = 'YOUR_PROPERTY_ID_HERE';
```

Repeat for each of the 3 iAqualink properties. Property IDs can be found by running:
```sql
SELECT id, name FROM walt.properties WHERE has_pool = true;
```

- [ ] **Step 6: Trigger a manual cron test and verify**

```bash
curl -v -X POST https://ai.walt-services.com/api/cron/poll-pool-temps \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected: `{"ok":true,"polled":3}`. Check `/var/log/walt-cron.log` for temperature output lines.

- [ ] **Step 7: Verify the dashboard**

Open `https://ai.walt-services.com/today` — Pool Temperatures section should appear with a card for each iAqualink property.
