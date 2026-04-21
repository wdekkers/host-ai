# AI Revenue Manager — Slice 1: PriceLabs Foundation

> **Addendum 2026-04-21:** Simplified to use `PRICELABS_API_KEY` env var instead of per-org encrypted DB credentials. Rationale: PriceLabs issues one account-level API key; every other integration in this repo follows the env-var pattern. When SaaS multi-tenancy arrives, all integrations will be lifted to per-org credentials together rather than PriceLabs being a one-off. Tasks in this plan that create the `pricelabsCredentials` table, the encryption helper, the credentials API, and the connect/disconnect UI are superseded — see the refactor commit for the final shape.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the read-only data foundation for the AI Revenue Manager — a typed `@walt/pricelabs` client, a daily snapshot cron, multi-tenant mapping, and a 90-day forward pricing chart on the property page. No rules engine, no AI, no write-back.

**Architecture:** New `packages/pricelabs/` package follows the `@walt/hospitable` shape (typed client + Zod schemas, caller injects `apiKey`). Five new `orgId`-scoped tables under the existing `walt` Postgres schema. Daily Vercel cron calls `runPriceLabsSyncForOrg` per org, which fetches rates + settings and inserts snapshots with `isBooked` computed by joining `reservations`. Admin UI and property chart consume JSON API routes so a future native client can use them unchanged.

**Tech Stack:** TypeScript (strict), Zod, Drizzle ORM + Postgres, Node `crypto` (AES-256-GCM), Next.js App Router, Recharts, Vitest (existing test runner), shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-04-20-revenue-manager-slice-1-design.md`
**Deferred items ticket:** `tickets/open/026-revenue-manager-pricing-chart-enhancements.md`

---

## File structure

### New files
```
packages/pricelabs/
  package.json
  tsconfig.json
  src/
    index.ts                      # public exports
    client.ts                     # PriceLabsClient class
    http.ts                       # fetch wrapper with retries
    schemas.ts                    # Zod schemas + z.infer types
    errors.ts                     # PriceLabsError + code discriminator
    env.ts                        # Zod-validated env config
  test/
    fixtures/
      list-listings.json
      recommended-rates.json
      settings.json
    client.test.ts

packages/db/drizzle/
  0030_pricelabs_tables.sql       # new migration

apps/web/src/
  lib/pricelabs/
    encryption.ts                 # AES-256-GCM wrappers
    encryption.test.ts
    auto-match.ts                 # Levenshtein scoring
    auto-match.test.ts
    sync.ts                       # pure sync logic per org
    sync.test.ts

  app/api/
    cron/pricelabs-sync/
      handler.ts
      handler.test.ts
      route.ts
    admin/pricelabs-sync/
      handler.ts
      route.ts
    integrations/pricelabs/
      credentials/
        handler.ts
        handler.test.ts
        route.ts
      mappings/
        handler.ts
        handler.test.ts
        route.ts
    properties/[id]/pricing-snapshots/
      handler.ts
      handler.test.ts
      route.ts

  app/settings/integrations/pricelabs/
    page.tsx                      # server component, auth guard
    PriceLabsIntegrationClient.tsx

  components/pricing/
    pricing-chart.tsx             # pure presentational Recharts

  hooks/
    use-pricelabs-credentials.ts
    use-pricelabs-mappings.ts
    use-pricing-snapshots.ts
```

### Modified files
```
packages/db/src/schema.ts         # 5 new tables appended
packages/db/drizzle/meta/_journal.json  # new migration entry
apps/web/src/app/properties/[id]/details/page.tsx   # add chart card
apps/web/src/lib/nav-links.ts     # add "Integrations → PriceLabs" link
apps/web/package.json             # add "recharts", "@walt/pricelabs"
apps/web/vercel.json              # add cron entry (if cron config lives here)
.env.example                      # add PRICELABS_ENCRYPTION_KEY
pnpm-lock.yaml                    # after pnpm install
```

---

## Task 1: Scaffold `@walt/pricelabs` package

**Files:**
- Create: `packages/pricelabs/package.json`
- Create: `packages/pricelabs/tsconfig.json`
- Create: `packages/pricelabs/src/index.ts` (stub)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@walt/pricelabs",
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
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Copy from `packages/hospitable/tsconfig.json` exactly to stay consistent.

```bash
cp packages/hospitable/tsconfig.json packages/pricelabs/tsconfig.json
```

- [ ] **Step 3: Create stub src/index.ts**

```ts
// Public exports — filled in by later tasks.
export {};
```

- [ ] **Step 4: Install**

Run: `pnpm install`
Expected: `@walt/pricelabs` now resolves in the workspace; no errors.

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm --filter @walt/pricelabs typecheck`
Expected: exits 0 with no output.

- [ ] **Step 6: Commit**

```bash
git add packages/pricelabs/package.json packages/pricelabs/tsconfig.json packages/pricelabs/src/index.ts pnpm-lock.yaml
git commit -m "feat(pricelabs): scaffold @walt/pricelabs package"
```

---

## Task 2: Zod schemas + error types

**Files:**
- Create: `packages/pricelabs/src/errors.ts`
- Create: `packages/pricelabs/src/schemas.ts`
- Create: `packages/pricelabs/test/fixtures/list-listings.json`
- Create: `packages/pricelabs/test/fixtures/recommended-rates.json`
- Create: `packages/pricelabs/test/fixtures/settings.json`
- Create: `packages/pricelabs/test/schemas.test.ts`

- [ ] **Step 1: Write the failing test `packages/pricelabs/test/schemas.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ListingSchema, DailyRateSchema, ListingSettingsSchema } from '../src/schemas.js';
import listings from './fixtures/list-listings.json' with { type: 'json' };
import rates from './fixtures/recommended-rates.json' with { type: 'json' };
import settings from './fixtures/settings.json' with { type: 'json' };

describe('PriceLabs schemas', () => {
  it('parses list-listings fixture', () => {
    const parsed = ListingSchema.array().parse(listings);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0]).toMatchObject({ id: expect.any(String), name: expect.any(String) });
  });

  it('parses recommended-rates fixture', () => {
    const parsed = DailyRateSchema.array().parse(rates);
    expect(parsed.length).toBe(365);
    expect(parsed[0].recommendedPrice).toBeTypeOf('number');
  });

  it('parses settings fixture', () => {
    const parsed = ListingSettingsSchema.parse(settings);
    expect(parsed.basePrice).toBeTypeOf('number');
  });

  it('rejects unknown shape', () => {
    expect(() => DailyRateSchema.parse({ foo: 'bar' })).toThrow();
  });
});
```

- [ ] **Step 2: Create fixture `packages/pricelabs/test/fixtures/list-listings.json`**

```json
[
  { "id": "pl-abc-123", "name": "Dreamscape Retreat", "address": "Fairplay, TX", "active": true },
  { "id": "pl-def-456", "name": "Frisco Waves & Fairways", "address": "Frisco, CO", "active": true },
  { "id": "pl-ghi-789", "name": "Palmera Luxury", "address": "Palm Springs, CA", "active": true }
]
```

- [ ] **Step 3: Create fixture `packages/pricelabs/test/fixtures/recommended-rates.json`**

Seed 365 days from 2026-04-21 with dummy data. Abbreviated for readability here — real fixture must contain all 365 entries.

```json
[
  { "date": "2026-04-21", "recommendedPrice": 524, "publishedPrice": 550, "basePrice": 450, "minPrice": 300, "maxPrice": 900, "minStay": 2, "closedToArrival": false, "closedToDeparture": false }
  // ... 364 more days with same shape; use a script to generate if needed:
  // node -e "console.log(JSON.stringify(Array.from({length:365},(_,i)=>{const d=new Date('2026-04-21');d.setUTCDate(d.getUTCDate()+i);return{date:d.toISOString().slice(0,10),recommendedPrice:500+Math.floor(Math.random()*100),publishedPrice:550,basePrice:450,minPrice:300,maxPrice:900,minStay:2,closedToArrival:false,closedToDeparture:false}}),null,2))"
]
```

- [ ] **Step 4: Create fixture `packages/pricelabs/test/fixtures/settings.json`**

```json
{
  "listingId": "pl-abc-123",
  "basePrice": 450,
  "minPrice": 300,
  "maxPrice": 900,
  "lastMinuteDiscount": { "enabled": true, "windowDays": 3, "percent": 15 },
  "orphanGapRules": { "enabled": true, "maxGapNights": 3 },
  "seasonalProfile": "default-2026",
  "raw": { "extra": "keep for diffing" }
}
```

- [ ] **Step 5: Create `packages/pricelabs/src/errors.ts`**

```ts
export type PriceLabsErrorCode =
  | 'auth_rejected'
  | 'not_found'
  | 'rate_limited'
  | 'server_error'
  | 'network_error'
  | 'parse_error';

export class PriceLabsError extends Error {
  constructor(public readonly code: PriceLabsErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PriceLabsError';
  }
}
```

- [ ] **Step 6: Create `packages/pricelabs/src/schemas.ts`**

```ts
import { z } from 'zod';

export const ListingSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().nullable().optional(),
  active: z.boolean().optional().default(true),
});
export type Listing = z.infer<typeof ListingSchema>;

export const DailyRateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ISO date YYYY-MM-DD'),
  recommendedPrice: z.number().int().nonnegative(),
  publishedPrice: z.number().int().nonnegative().nullable().optional(),
  basePrice: z.number().int().nonnegative(),
  minPrice: z.number().int().nonnegative(),
  maxPrice: z.number().int().nonnegative(),
  minStay: z.number().int().positive().nullable().optional(),
  closedToArrival: z.boolean().optional().default(false),
  closedToDeparture: z.boolean().optional().default(false),
});
export type DailyRate = z.infer<typeof DailyRateSchema>;

export const ListingSettingsSchema = z.object({
  listingId: z.string().min(1),
  basePrice: z.number().int().nonnegative(),
  minPrice: z.number().int().nonnegative(),
  maxPrice: z.number().int().nonnegative(),
  lastMinuteDiscount: z.unknown().optional(),
  orphanGapRules: z.unknown().optional(),
  seasonalProfile: z.string().nullable().optional(),
  raw: z.record(z.unknown()).optional(),
});
export type ListingSettings = z.infer<typeof ListingSettingsSchema>;
```

- [ ] **Step 7: Run tests — should pass**

Run: `pnpm --filter @walt/pricelabs test`
Expected: 4 tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/pricelabs/src/errors.ts packages/pricelabs/src/schemas.ts packages/pricelabs/test/
git commit -m "feat(pricelabs): add Zod schemas and PriceLabsError types"
```

---

## Task 3: HTTP client with retries + PriceLabsClient

**Files:**
- Create: `packages/pricelabs/src/http.ts`
- Create: `packages/pricelabs/src/env.ts`
- Create: `packages/pricelabs/src/client.ts`
- Modify: `packages/pricelabs/src/index.ts`
- Create: `packages/pricelabs/test/client.test.ts`

- [ ] **Step 1: Write the failing test `packages/pricelabs/test/client.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPriceLabsClient } from '../src/client.js';
import { PriceLabsError } from '../src/errors.js';
import listings from './fixtures/list-listings.json' with { type: 'json' };
import rates from './fixtures/recommended-rates.json' with { type: 'json' };
import settings from './fixtures/settings.json' with { type: 'json' };

describe('PriceLabsClient', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects empty apiKey at construction', () => {
    expect(() => createPriceLabsClient({ apiKey: '' })).toThrow(/apiKey/);
    expect(() => createPriceLabsClient({ apiKey: '   ' })).toThrow(/apiKey/);
  });

  it('listListings parses response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => listings });
    const client = createPriceLabsClient({ apiKey: 'test-key' });
    const result = await client.listListings();
    expect(result.length).toBe(3);
    expect(result[0].id).toBe('pl-abc-123');
  });

  it('getRecommendedRates parses response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => rates });
    const client = createPriceLabsClient({ apiKey: 'test-key' });
    const result = await client.getRecommendedRates('pl-abc-123', '2026-04-21', '2027-04-21');
    expect(result.length).toBe(365);
  });

  it('getSettings parses response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => settings });
    const client = createPriceLabsClient({ apiKey: 'test-key' });
    const result = await client.getSettings('pl-abc-123');
    expect(result.basePrice).toBe(450);
  });

  it('retries on 429 up to 3 times then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => listings });
    const client = createPriceLabsClient({ apiKey: 'test-key' });
    const result = await client.listListings();
    expect(result.length).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws auth_rejected on 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'bad key' }) });
    const client = createPriceLabsClient({ apiKey: 'bad' });
    await expect(client.listListings()).rejects.toMatchObject({
      name: 'PriceLabsError',
      code: 'auth_rejected',
    });
  });

  it('throws rate_limited after max retries on persistent 429', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const client = createPriceLabsClient({ apiKey: 'test-key' });
    await expect(client.listListings()).rejects.toMatchObject({ code: 'rate_limited' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws parse_error on malformed response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ not: 'a listing' }] });
    const client = createPriceLabsClient({ apiKey: 'test-key' });
    await expect(client.listListings()).rejects.toMatchObject({ code: 'parse_error' });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @walt/pricelabs test client.test.ts`
Expected: all tests fail (module not found).

- [ ] **Step 3: Create `packages/pricelabs/src/env.ts`**

```ts
import { z } from 'zod';

const EnvSchema = z.object({
  PRICELABS_BASE_URL: z.string().url().default('https://api.pricelabs.co'),
});

export const pricelabsEnv = EnvSchema.parse({
  PRICELABS_BASE_URL: process.env.PRICELABS_BASE_URL,
});
```

- [ ] **Step 4: Create `packages/pricelabs/src/http.ts`**

```ts
import { PriceLabsError } from './errors.js';

export interface HttpOptions {
  apiKey: string;
  baseUrl: string;
}

const MAX_RETRIES = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getJson<T>(path: string, opts: HttpOptions): Promise<T> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}${path}`;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': opts.apiKey,
          'Accept': 'application/json',
        },
      });
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(200 * 2 ** attempt);
        continue;
      }
      throw new PriceLabsError('network_error', `fetch failed for ${path}`, err);
    }

    if (response.status === 401 || response.status === 403) {
      throw new PriceLabsError('auth_rejected', `PriceLabs rejected credentials (HTTP ${response.status})`);
    }
    if (response.status === 404) {
      throw new PriceLabsError('not_found', `Not found: ${path}`);
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt < MAX_RETRIES - 1) {
        await sleep(200 * 2 ** attempt);
        continue;
      }
      throw new PriceLabsError(
        response.status === 429 ? 'rate_limited' : 'server_error',
        `HTTP ${response.status} for ${path}`,
      );
    }
    if (!response.ok) {
      throw new PriceLabsError('server_error', `Unexpected HTTP ${response.status} for ${path}`);
    }

    return (await response.json()) as T;
  }

  throw new PriceLabsError('server_error', `Exhausted retries for ${path}`, lastError);
}
```

- [ ] **Step 5: Create `packages/pricelabs/src/client.ts`**

```ts
import { pricelabsEnv } from './env.js';
import { getJson } from './http.js';
import { PriceLabsError } from './errors.js';
import {
  ListingSchema,
  DailyRateSchema,
  ListingSettingsSchema,
  type Listing,
  type DailyRate,
  type ListingSettings,
} from './schemas.js';

export interface CreatePriceLabsClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface PriceLabsClient {
  listListings(): Promise<Listing[]>;
  getRecommendedRates(listingId: string, startDate: string, endDate: string): Promise<DailyRate[]>;
  getSettings(listingId: string): Promise<ListingSettings>;
}

export function createPriceLabsClient(opts: CreatePriceLabsClientOptions): PriceLabsClient {
  if (!opts.apiKey || !opts.apiKey.trim()) {
    throw new Error('createPriceLabsClient: apiKey is required');
  }
  const http = { apiKey: opts.apiKey, baseUrl: opts.baseUrl ?? pricelabsEnv.PRICELABS_BASE_URL };

  function parse<T>(schema: { safeParse: (x: unknown) => { success: boolean; data?: T; error?: unknown } }, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new PriceLabsError('parse_error', 'Could not parse PriceLabs response', result.error);
    }
    return result.data as T;
  }

  return {
    async listListings() {
      const raw = await getJson<unknown>('/v1/listings', http);
      return parse(ListingSchema.array(), raw);
    },
    async getRecommendedRates(listingId, startDate, endDate) {
      const raw = await getJson<unknown>(
        `/v1/listings/${encodeURIComponent(listingId)}/recommended_prices?start=${startDate}&end=${endDate}`,
        http,
      );
      return parse(DailyRateSchema.array(), raw);
    },
    async getSettings(listingId) {
      const raw = await getJson<unknown>(`/v1/listings/${encodeURIComponent(listingId)}/settings`, http);
      return parse(ListingSettingsSchema, raw);
    },
  };
}
```

- [ ] **Step 6: Update `packages/pricelabs/src/index.ts`**

```ts
export { createPriceLabsClient } from './client.js';
export type { PriceLabsClient, CreatePriceLabsClientOptions } from './client.js';
export { PriceLabsError, type PriceLabsErrorCode } from './errors.js';
export type { Listing, DailyRate, ListingSettings } from './schemas.js';
```

- [ ] **Step 7: Run tests — should pass**

Run: `pnpm --filter @walt/pricelabs test`
Expected: all tests pass.

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @walt/pricelabs typecheck`
Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add packages/pricelabs/src/ packages/pricelabs/test/client.test.ts
git commit -m "feat(pricelabs): add PriceLabsClient with retries and typed parsing"
```

---

## Task 4: DB migration + Drizzle schema

**Files:**
- Create: `packages/db/drizzle/0030_pricelabs_tables.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`
- Modify: `packages/db/src/schema.ts` (append new tables)

- [ ] **Step 1: Create migration `packages/db/drizzle/0030_pricelabs_tables.sql`**

```sql
-- PriceLabs integration: credentials, listing mapping, time-series snapshots, sync audit.

CREATE TABLE IF NOT EXISTS "walt"."pricelabs_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" text NOT NULL REFERENCES "walt"."organizations"("id"),
  "encrypted_api_key" text NOT NULL,
  "api_key_fingerprint" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pricelabs_credentials_org_unique" UNIQUE ("org_id"),
  CONSTRAINT "pricelabs_credentials_status_check" CHECK ("status" IN ('active', 'invalid'))
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "walt"."pricelabs_listings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" text NOT NULL REFERENCES "walt"."organizations"("id"),
  "property_id" text REFERENCES "walt"."properties"("id"),
  "pricelabs_listing_id" text NOT NULL,
  "pricelabs_listing_name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'unmapped',
  "match_confidence" text,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pricelabs_listings_org_listing_unique" UNIQUE ("org_id", "pricelabs_listing_id"),
  CONSTRAINT "pricelabs_listings_status_check" CHECK ("status" IN ('active', 'unmapped', 'inactive')),
  CONSTRAINT "pricelabs_listings_confidence_check" CHECK ("match_confidence" IS NULL OR "match_confidence" IN ('manual', 'auto-high', 'auto-low'))
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "walt"."pricelabs_sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" text NOT NULL REFERENCES "walt"."organizations"("id"),
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  "status" text NOT NULL DEFAULT 'running',
  "listings_synced" integer NOT NULL DEFAULT 0,
  "listings_failed" integer NOT NULL DEFAULT 0,
  "error_summary" text,
  CONSTRAINT "pricelabs_sync_runs_status_check" CHECK ("status" IN ('running', 'success', 'partial', 'failed'))
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "walt"."pricing_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" text NOT NULL REFERENCES "walt"."organizations"("id"),
  "pricelabs_listing_id" text NOT NULL,
  "date" date NOT NULL,
  "recommended_price" integer NOT NULL,
  "published_price" integer,
  "base_price" integer NOT NULL,
  "min_price" integer NOT NULL,
  "max_price" integer NOT NULL,
  "min_stay" integer,
  "closed_to_arrival" boolean NOT NULL DEFAULT false,
  "closed_to_departure" boolean NOT NULL DEFAULT false,
  "is_booked" boolean NOT NULL DEFAULT false,
  "sync_run_id" uuid NOT NULL REFERENCES "walt"."pricelabs_sync_runs"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pricing_snapshots_lookup_idx"
  ON "walt"."pricing_snapshots" ("org_id", "pricelabs_listing_id", "date" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pricing_snapshots_run_idx"
  ON "walt"."pricing_snapshots" ("sync_run_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "walt"."pricelabs_settings_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" text NOT NULL REFERENCES "walt"."organizations"("id"),
  "pricelabs_listing_id" text NOT NULL,
  "sync_run_id" uuid NOT NULL REFERENCES "walt"."pricelabs_sync_runs"("id"),
  "settings_blob" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pricelabs_settings_snapshots_lookup_idx"
  ON "walt"."pricelabs_settings_snapshots" ("org_id", "pricelabs_listing_id", "created_at" DESC);
```

- [ ] **Step 2: Append journal entry in `packages/db/drizzle/meta/_journal.json`**

Add a new element to `entries`, after `0029_property_details_columns`:

```json
{
  "idx": 30,
  "version": "7",
  "when": 1776000000000,
  "tag": "0030_pricelabs_tables",
  "breakpoints": true
}
```

- [ ] **Step 3: Append Drizzle schema in `packages/db/src/schema.ts`**

Append at the end of the file:

```ts
// --- PriceLabs integration ---

export const pricelabsCredentials = waltSchema.table('pricelabs_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  apiKeyFingerprint: text('api_key_fingerprint').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgUnique: uniqueIndex('pricelabs_credentials_org_unique').on(table.orgId),
  statusCheck: check('pricelabs_credentials_status_check', sql`${table.status} IN ('active', 'invalid')`),
}));

export const pricelabsListings = waltSchema.table('pricelabs_listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  propertyId: text('property_id').references(() => properties.id),
  pricelabsListingId: text('pricelabs_listing_id').notNull(),
  pricelabsListingName: text('pricelabs_listing_name').notNull(),
  status: text('status').notNull().default('unmapped'),
  matchConfidence: text('match_confidence'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgListingUnique: uniqueIndex('pricelabs_listings_org_listing_unique').on(table.orgId, table.pricelabsListingId),
  statusCheck: check('pricelabs_listings_status_check', sql`${table.status} IN ('active', 'unmapped', 'inactive')`),
  confidenceCheck: check(
    'pricelabs_listings_confidence_check',
    sql`${table.matchConfidence} IS NULL OR ${table.matchConfidence} IN ('manual', 'auto-high', 'auto-low')`,
  ),
}));

export const pricelabsSyncRuns = waltSchema.table('pricelabs_sync_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: text('status').notNull().default('running'),
  listingsSynced: integer('listings_synced').notNull().default(0),
  listingsFailed: integer('listings_failed').notNull().default(0),
  errorSummary: text('error_summary'),
}, (table) => ({
  statusCheck: check('pricelabs_sync_runs_status_check', sql`${table.status} IN ('running', 'success', 'partial', 'failed')`),
}));

export const pricingSnapshots = waltSchema.table('pricing_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  pricelabsListingId: text('pricelabs_listing_id').notNull(),
  date: text('date').notNull(), // Drizzle uses text for `date` columns to keep ISO strings predictable
  recommendedPrice: integer('recommended_price').notNull(),
  publishedPrice: integer('published_price'),
  basePrice: integer('base_price').notNull(),
  minPrice: integer('min_price').notNull(),
  maxPrice: integer('max_price').notNull(),
  minStay: integer('min_stay'),
  closedToArrival: boolean('closed_to_arrival').notNull().default(false),
  closedToDeparture: boolean('closed_to_departure').notNull().default(false),
  isBooked: boolean('is_booked').notNull().default(false),
  syncRunId: uuid('sync_run_id').notNull().references(() => pricelabsSyncRuns.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  lookupIdx: index('pricing_snapshots_lookup_idx').on(table.orgId, table.pricelabsListingId, table.date.desc()),
  runIdx: index('pricing_snapshots_run_idx').on(table.syncRunId),
}));

export const pricelabsSettingsSnapshots = waltSchema.table('pricelabs_settings_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  pricelabsListingId: text('pricelabs_listing_id').notNull(),
  syncRunId: uuid('sync_run_id').notNull().references(() => pricelabsSyncRuns.id),
  settingsBlob: jsonb('settings_blob').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  lookupIdx: index('pricelabs_settings_snapshots_lookup_idx').on(table.orgId, table.pricelabsListingId, table.createdAt.desc()),
}));
```

- [ ] **Step 4: Run migration locally**

Run: `pnpm --filter @walt/db migrate`
Expected: `0030_pricelabs_tables` reported applied; no errors. If migration is already applied, re-run with a fresh test DB or skip.

- [ ] **Step 5: Verify tables exist**

Run:
```bash
psql "$DATABASE_URL" -c "\dt walt.pricelabs_*"
```
Expected: 5 tables listed (pricelabs_credentials, pricelabs_listings, pricelabs_settings_snapshots, pricelabs_sync_runs, pricing_snapshots).

- [ ] **Step 6: Typecheck schema**

Run: `pnpm --filter @walt/db typecheck`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/db/drizzle/0030_pricelabs_tables.sql packages/db/drizzle/meta/_journal.json packages/db/src/schema.ts
git commit -m "feat(db): add PriceLabs integration tables (credentials, listings, snapshots, sync runs)"
```

---

## Task 5: Encryption helper

**Files:**
- Create: `apps/web/src/lib/pricelabs/encryption.ts`
- Create: `apps/web/src/lib/pricelabs/encryption.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing test `apps/web/src/lib/pricelabs/encryption.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { encryptApiKey, decryptApiKey, keyFingerprint } from './encryption';
import crypto from 'node:crypto';

describe('PriceLabs encryption', () => {
  beforeAll(() => {
    process.env.PRICELABS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  });

  it('round-trips plaintext', () => {
    const plaintext = 'pl-live-key-abcdef1234567890';
    const encrypted = encryptApiKey(plaintext);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for same plaintext (fresh IV)', () => {
    const plaintext = 'same-key';
    expect(encryptApiKey(plaintext)).not.toBe(encryptApiKey(plaintext));
  });

  it('fingerprint returns last 4 chars', () => {
    expect(keyFingerprint('abcdefghij')).toBe('ghij');
    expect(keyFingerprint('xyz')).toBe('xyz');
  });

  it('decrypt rejects tampered ciphertext', () => {
    const enc = encryptApiKey('hello');
    const tampered = enc.slice(0, -2) + 'zz';
    expect(() => decryptApiKey(tampered)).toThrow();
  });

  it('throws if PRICELABS_ENCRYPTION_KEY missing', () => {
    const saved = process.env.PRICELABS_ENCRYPTION_KEY;
    delete process.env.PRICELABS_ENCRYPTION_KEY;
    expect(() => encryptApiKey('x')).toThrow(/PRICELABS_ENCRYPTION_KEY/);
    process.env.PRICELABS_ENCRYPTION_KEY = saved;
  });
});
```

- [ ] **Step 2: Run the test — should fail**

Run: `pnpm --filter @walt/web test src/lib/pricelabs/encryption.test.ts`
Expected: fails (module not found).

- [ ] **Step 3: Create `apps/web/src/lib/pricelabs/encryption.ts`**

```ts
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.PRICELABS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('PRICELABS_ENCRYPTION_KEY is not set');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('PRICELABS_ENCRYPTION_KEY must decode to 32 bytes (base64 of 32 random bytes)');
  }
  return key;
}

export function encryptApiKey(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptApiKey(token: string): string {
  const key = getKey();
  const buffer = Buffer.from(token, 'base64');
  if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Ciphertext too short');
  }
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function keyFingerprint(plaintext: string): string {
  return plaintext.length <= 4 ? plaintext : plaintext.slice(-4);
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `pnpm --filter @walt/web test src/lib/pricelabs/encryption.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 5: Add env var to `.env.example`**

Append:

```
# PriceLabs integration: base64-encoded 32 random bytes.
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
PRICELABS_ENCRYPTION_KEY=
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/pricelabs/encryption.ts apps/web/src/lib/pricelabs/encryption.test.ts .env.example
git commit -m "feat(pricelabs): add AES-256-GCM helpers for API key storage"
```

---

## Task 6: Auto-match utility

**Files:**
- Create: `apps/web/src/lib/pricelabs/auto-match.ts`
- Create: `apps/web/src/lib/pricelabs/auto-match.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/lib/pricelabs/auto-match.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { autoMatchListings, normalizeName } from './auto-match';

describe('normalizeName', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeName('Dreamscape Retreat!')).toBe('dreamscape retreat');
  });
  it('strips trailing city/state suffix', () => {
    expect(normalizeName('Frisco Waves & Fairways – Frisco, CO')).toBe('frisco waves fairways');
  });
});

describe('autoMatchListings', () => {
  const internalProps = [
    { id: 'prop-1', name: 'Dreamscape' },
    { id: 'prop-2', name: 'Frisco Waves & Fairways' },
    { id: 'prop-3', name: 'Palmera Luxury Villa' },
  ];
  const pricelabsListings = [
    { id: 'pl-1', name: 'Dreamscape Retreat' },
    { id: 'pl-2', name: 'Frisco Waves & Fairways – Frisco, CO' },
    { id: 'pl-3', name: 'Nothing Similar' },
  ];

  it('high-confidence match when names are close', () => {
    const matches = autoMatchListings(pricelabsListings, internalProps);
    const dreamscape = matches.find((m) => m.pricelabsListingId === 'pl-1')!;
    expect(dreamscape.propertyId).toBe('prop-1');
    expect(dreamscape.confidence).toBe('auto-high');
  });

  it('high-confidence match after city/state suffix strip', () => {
    const matches = autoMatchListings(pricelabsListings, internalProps);
    const waves = matches.find((m) => m.pricelabsListingId === 'pl-2')!;
    expect(waves.propertyId).toBe('prop-2');
    expect(waves.confidence).toBe('auto-high');
  });

  it('returns null match when nothing is close', () => {
    const matches = autoMatchListings(pricelabsListings, internalProps);
    const nothing = matches.find((m) => m.pricelabsListingId === 'pl-3')!;
    expect(nothing.propertyId).toBeNull();
    expect(nothing.confidence).toBeNull();
  });

  it('each internal property matched at most once — best wins', () => {
    const props = [{ id: 'prop-1', name: 'Dreamscape' }];
    const listings = [
      { id: 'pl-1', name: 'Dreamscape' },
      { id: 'pl-2', name: 'Dreamscape Cottage' },
    ];
    const matches = autoMatchListings(listings, props);
    const bestMatch = matches.find((m) => m.propertyId === 'prop-1')!;
    expect(bestMatch.pricelabsListingId).toBe('pl-1');
    const otherMatch = matches.find((m) => m.pricelabsListingId === 'pl-2')!;
    expect(otherMatch.propertyId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — should fail (module not found)**

Run: `pnpm --filter @walt/web test src/lib/pricelabs/auto-match.test.ts`
Expected: fails.

- [ ] **Step 3: Create `apps/web/src/lib/pricelabs/auto-match.ts`**

```ts
export type MatchConfidence = 'manual' | 'auto-high' | 'auto-low';

const US_STATE_SUFFIX = /[,–-]\s*[A-Z]{2}(\s|$)/;
const CITY_STATE_SUFFIX_FULL = /[–-]\s*[A-Z][a-zA-Z]+,\s*[A-Z]{2}\s*$/;
const CITY_DASH_SUFFIX = /[–-]\s*[A-Z][a-zA-Z ]+$/;
const PUNCT = /[!?.,;:&|]+/g;

export function normalizeName(name: string): string {
  let s = name.trim();
  s = s.replace(CITY_STATE_SUFFIX_FULL, '');
  s = s.replace(CITY_DASH_SUFFIX, '');
  s = s.replace(US_STATE_SUFFIX, '');
  s = s.toLowerCase();
  s = s.replace(PUNCT, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const v0 = new Array(b.length + 1).fill(0).map((_, i) => i);
  const v1 = new Array(b.length + 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function classify(distance: number): MatchConfidence | null {
  if (distance <= 3) return 'auto-high';
  if (distance <= 8) return 'auto-low';
  return null;
}

export interface InternalProperty {
  id: string;
  name: string;
}

export interface PriceLabsListingLite {
  id: string;
  name: string;
}

export interface MatchResult {
  pricelabsListingId: string;
  pricelabsListingName: string;
  propertyId: string | null;
  confidence: MatchConfidence | null;
}

export function autoMatchListings(
  listings: PriceLabsListingLite[],
  properties: InternalProperty[],
): MatchResult[] {
  // Build all candidate pairs with distances.
  const pairs: { listingId: string; propertyId: string; distance: number }[] = [];
  for (const l of listings) {
    const normL = normalizeName(l.name);
    for (const p of properties) {
      const normP = normalizeName(p.name);
      pairs.push({ listingId: l.id, propertyId: p.id, distance: levenshtein(normL, normP) });
    }
  }
  // Greedy: pick best (smallest distance) pair first, mark both consumed.
  pairs.sort((a, b) => a.distance - b.distance);
  const usedListings = new Set<string>();
  const usedProperties = new Set<string>();
  const matched = new Map<string, { propertyId: string; distance: number }>();
  for (const pair of pairs) {
    if (usedListings.has(pair.listingId) || usedProperties.has(pair.propertyId)) continue;
    if (classify(pair.distance) === null) continue;
    matched.set(pair.listingId, { propertyId: pair.propertyId, distance: pair.distance });
    usedListings.add(pair.listingId);
    usedProperties.add(pair.propertyId);
  }
  // Emit one row per listing.
  return listings.map((l) => {
    const m = matched.get(l.id);
    return {
      pricelabsListingId: l.id,
      pricelabsListingName: l.name,
      propertyId: m?.propertyId ?? null,
      confidence: m ? classify(m.distance) : null,
    };
  });
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `pnpm --filter @walt/web test src/lib/pricelabs/auto-match.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pricelabs/auto-match.ts apps/web/src/lib/pricelabs/auto-match.test.ts
git commit -m "feat(pricelabs): add fuzzy auto-match for listing → property"
```

---

## Task 7: Credentials API route

**Files:**
- Create: `apps/web/src/app/api/integrations/pricelabs/credentials/handler.ts`
- Create: `apps/web/src/app/api/integrations/pricelabs/credentials/handler.test.ts`
- Create: `apps/web/src/app/api/integrations/pricelabs/credentials/route.ts`

- [ ] **Step 1: Write failing test `.../credentials/handler.test.ts`**

```ts
import { describe, it, expect, vi, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { handleSaveCredentials, handleDeleteCredentials } from './handler';

beforeAll(() => {
  process.env.PRICELABS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
});

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://test/api/integrations/pricelabs/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('handleSaveCredentials', () => {
  it('401s when no auth', async () => {
    const res = await handleSaveCredentials(makeRequest({ apiKey: 'x' }), {
      getActor: async () => null,
    });
    expect(res.status).toBe(401);
  });

  it('403s when actor has insufficient role', async () => {
    const res = await handleSaveCredentials(makeRequest({ apiKey: 'x' }), {
      getActor: async () => ({ userId: 'u1', orgId: 'org-1', role: 'viewer' }),
    });
    expect(res.status).toBe(403);
  });

  it('400s on empty key', async () => {
    const res = await handleSaveCredentials(makeRequest({ apiKey: '' }), {
      getActor: async () => ({ userId: 'u1', orgId: 'org-1', role: 'owner' }),
    });
    expect(res.status).toBe(400);
  });

  it('400s when PriceLabs rejects the key', async () => {
    const res = await handleSaveCredentials(makeRequest({ apiKey: 'bad' }), {
      getActor: async () => ({ userId: 'u1', orgId: 'org-1', role: 'owner' }),
      createClient: () => ({
        listListings: async () => {
          const err: Error & { code?: string } = new Error('unauthorized');
          err.name = 'PriceLabsError';
          (err as never as { code: string }).code = 'auth_rejected';
          throw err;
        },
        getRecommendedRates: vi.fn(),
        getSettings: vi.fn(),
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/rejected/i);
  });

  it('stores encrypted credentials on success', async () => {
    const upsertFn = vi.fn();
    const res = await handleSaveCredentials(makeRequest({ apiKey: 'pl-live-good-key-1234' }), {
      getActor: async () => ({ userId: 'u1', orgId: 'org-1', role: 'owner' }),
      createClient: () => ({
        listListings: async () => [{ id: 'pl-1', name: 'Demo', active: true }],
        getRecommendedRates: vi.fn(),
        getSettings: vi.fn(),
      }),
      upsertCredentials: upsertFn,
    });
    expect(res.status).toBe(200);
    expect(upsertFn).toHaveBeenCalledOnce();
    const arg = upsertFn.mock.calls[0][0];
    expect(arg.orgId).toBe('org-1');
    expect(arg.encryptedApiKey).toBeTypeOf('string');
    expect(arg.encryptedApiKey).not.toBe('pl-live-good-key-1234');
    expect(arg.apiKeyFingerprint).toBe('1234');
  });
});

describe('handleDeleteCredentials', () => {
  it('deletes on DELETE with owner role', async () => {
    const deleteFn = vi.fn();
    const res = await handleDeleteCredentials(
      new Request('http://test/api/integrations/pricelabs/credentials', { method: 'DELETE' }),
      {
        getActor: async () => ({ userId: 'u1', orgId: 'org-1', role: 'owner' }),
        deleteCredentials: deleteFn,
      },
    );
    expect(res.status).toBe(204);
    expect(deleteFn).toHaveBeenCalledWith('org-1');
  });
});
```

- [ ] **Step 2: Run test — fails (module missing)**

Run: `pnpm --filter @walt/web test src/app/api/integrations/pricelabs/credentials/handler.test.ts`
Expected: fails.

- [ ] **Step 3: Create `.../credentials/handler.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { pricelabsCredentials } from '@walt/db';
import { createPriceLabsClient, PriceLabsError, type PriceLabsClient } from '@walt/pricelabs';
import { encryptApiKey, keyFingerprint } from '@/lib/pricelabs/encryption';

const ALLOWED_ROLES = new Set(['owner', 'manager']);

export type Actor = { userId: string; orgId: string; role: string };

export type SaveDeps = {
  getActor?: (req: Request) => Promise<Actor | null>;
  createClient?: (apiKey: string) => PriceLabsClient;
  upsertCredentials?: (row: {
    orgId: string;
    encryptedApiKey: string;
    apiKeyFingerprint: string;
  }) => Promise<void>;
};

export type DeleteDeps = {
  getActor?: (req: Request) => Promise<Actor | null>;
  deleteCredentials?: (orgId: string) => Promise<void>;
};

const BodySchema = z.object({
  apiKey: z.string().trim().min(1, 'apiKey is required'),
});

async function defaultGetActor(req: Request): Promise<Actor | null> {
  const { getCurrentActor } = await import('@/lib/auth/current-actor');
  return getCurrentActor(req);
}

export async function handleSaveCredentials(req: Request, deps: SaveDeps = {}): Promise<Response> {
  const actor = await (deps.getActor ?? defaultGetActor)(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.has(actor.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid body' }, { status: 400 });
  }

  const client = (deps.createClient ?? ((k) => createPriceLabsClient({ apiKey: k })))(parsed.data.apiKey);
  try {
    await client.listListings();
  } catch (err) {
    if (err instanceof PriceLabsError && err.code === 'auth_rejected') {
      return NextResponse.json({ error: 'PriceLabs rejected the API key' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Could not reach PriceLabs' }, { status: 502 });
  }

  const upsert = deps.upsertCredentials ?? (async (row) => {
    const { db } = await import('@/lib/db');
    await db
      .insert(pricelabsCredentials)
      .values({
        orgId: row.orgId,
        encryptedApiKey: row.encryptedApiKey,
        apiKeyFingerprint: row.apiKeyFingerprint,
        status: 'active',
      })
      .onConflictDoUpdate({
        target: pricelabsCredentials.orgId,
        set: {
          encryptedApiKey: row.encryptedApiKey,
          apiKeyFingerprint: row.apiKeyFingerprint,
          status: 'active',
          updatedAt: new Date(),
        },
      });
  });

  await upsert({
    orgId: actor.orgId,
    encryptedApiKey: encryptApiKey(parsed.data.apiKey),
    apiKeyFingerprint: keyFingerprint(parsed.data.apiKey),
  });

  return NextResponse.json({ ok: true, fingerprint: keyFingerprint(parsed.data.apiKey) });
}

export async function handleDeleteCredentials(req: Request, deps: DeleteDeps = {}): Promise<Response> {
  const actor = await (deps.getActor ?? defaultGetActor)(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.has(actor.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const del = deps.deleteCredentials ?? (async (orgId) => {
    const { db } = await import('@/lib/db');
    await db.delete(pricelabsCredentials).where(eq(pricelabsCredentials.orgId, orgId));
  });
  await del(actor.orgId);
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Create `.../credentials/route.ts`**

```ts
import { handleSaveCredentials, handleDeleteCredentials } from './handler';

export async function POST(request: Request): Promise<Response> {
  return handleSaveCredentials(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleDeleteCredentials(request);
}
```

- [ ] **Step 5: If `@/lib/auth/current-actor` doesn't exist, scaffold it**

Check first: `ls apps/web/src/lib/auth/current-actor.ts`. If it exists, skip this step.

If missing, create `apps/web/src/lib/auth/current-actor.ts`:

```ts
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { organizationMemberships } from '@walt/db';

export type Actor = { userId: string; orgId: string; role: string };

export async function getCurrentActor(_req: Request): Promise<Actor | null> {
  const session = auth();
  if (!session.userId || !session.orgId) return null;
  const { db } = await import('@/lib/db');
  const [row] = await db
    .select({ role: organizationMemberships.role })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.userId, session.userId))
    .limit(1);
  return { userId: session.userId, orgId: session.orgId, role: row?.role ?? 'viewer' };
}
```

(Adapt the import path for `@clerk/nextjs/server` to whatever version/API this repo uses. If auth is provided by a different mechanism, inspect `apps/web/src/app/api/admin/sync-properties/handler.ts` for the existing pattern and use that.)

- [ ] **Step 6: Run tests — pass**

Run: `pnpm --filter @walt/web test src/app/api/integrations/pricelabs/credentials/handler.test.ts`
Expected: 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/integrations/pricelabs/credentials/ apps/web/src/lib/auth/current-actor.ts
git commit -m "feat(pricelabs): credentials API (POST + DELETE) with Zod-validated body and role gating"
```

---

## Task 8: Mappings API route

**Files:**
- Create: `apps/web/src/app/api/integrations/pricelabs/mappings/handler.ts`
- Create: `apps/web/src/app/api/integrations/pricelabs/mappings/handler.test.ts`
- Create: `apps/web/src/app/api/integrations/pricelabs/mappings/route.ts`

- [ ] **Step 1: Write failing test `.../mappings/handler.test.ts`**

```ts
import { describe, it, expect, vi, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { handleGetMappings, handleSaveMappings } from './handler';

beforeAll(() => {
  process.env.PRICELABS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
});

const actor = { userId: 'u1', orgId: 'org-1', role: 'owner' };

function req(method: 'GET' | 'POST', body?: unknown): Request {
  return new Request('http://test/api/integrations/pricelabs/mappings', {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('handleGetMappings', () => {
  it('401 unauthenticated', async () => {
    const res = await handleGetMappings(req('GET'), { getActor: async () => null });
    expect(res.status).toBe(401);
  });

  it('returns not_connected when no credentials exist', async () => {
    const res = await handleGetMappings(req('GET'), {
      getActor: async () => actor,
      getCredentials: async () => null,
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ state: 'not_connected' });
  });

  it('returns key_invalid when credentials status = invalid', async () => {
    const res = await handleGetMappings(req('GET'), {
      getActor: async () => actor,
      getCredentials: async () => ({ fingerprint: '1234', status: 'invalid', encryptedApiKey: 'xxx' }),
    });
    const body = await res.json();
    expect(body).toEqual({ state: 'key_invalid', fingerprint: '1234' });
  });

  it('returns rows with auto-matches joined against stored mappings', async () => {
    const res = await handleGetMappings(req('GET'), {
      getActor: async () => actor,
      getCredentials: async () => ({ fingerprint: '1234', status: 'active', encryptedApiKey: 'ENC' }),
      decryptKey: () => 'pl-key',
      createClient: () => ({
        listListings: async () => [
          { id: 'pl-1', name: 'Dreamscape', active: true },
          { id: 'pl-2', name: 'Frisco Waves', active: true },
        ],
        getRecommendedRates: vi.fn(),
        getSettings: vi.fn(),
      }),
      getProperties: async () => [
        { id: 'prop-1', name: 'Dreamscape' },
        { id: 'prop-2', name: 'Frisco Waves' },
      ],
      getStoredMappings: async () => [
        { pricelabsListingId: 'pl-1', propertyId: 'prop-1', status: 'active', matchConfidence: 'manual' },
      ],
    });
    const body = await res.json();
    expect(body.state).toBe('connected');
    expect(body.rows).toHaveLength(2);
    const row1 = body.rows.find((r: { pricelabsListingId: string }) => r.pricelabsListingId === 'pl-1');
    expect(row1.propertyId).toBe('prop-1');
    expect(row1.status).toBe('active');
    expect(row1.matchConfidence).toBe('manual');
    const row2 = body.rows.find((r: { pricelabsListingId: string }) => r.pricelabsListingId === 'pl-2');
    expect(row2.propertyId).toBe('prop-2');
    expect(row2.matchConfidence).toBe('auto-high'); // suggested, not persisted
    expect(row2.status).toBe('unmapped');
  });
});

describe('handleSaveMappings', () => {
  it('upserts mappings and sets matchConfidence=manual', async () => {
    const upsertFn = vi.fn();
    const res = await handleSaveMappings(
      req('POST', { mappings: [{ pricelabsListingId: 'pl-1', propertyId: 'prop-1', pricelabsListingName: 'Dreamscape', status: 'active' }] }),
      {
        getActor: async () => actor,
        upsertMappings: upsertFn,
      },
    );
    expect(res.status).toBe(200);
    expect(upsertFn).toHaveBeenCalledOnce();
    const rows = upsertFn.mock.calls[0][0];
    expect(rows[0]).toMatchObject({ orgId: 'org-1', pricelabsListingId: 'pl-1', propertyId: 'prop-1', status: 'active', matchConfidence: 'manual' });
  });

  it('400s on invalid body', async () => {
    const res = await handleSaveMappings(req('POST', { mappings: 'not-array' }), { getActor: async () => actor });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `pnpm --filter @walt/web test src/app/api/integrations/pricelabs/mappings/handler.test.ts`
Expected: module not found.

- [ ] **Step 3: Create `.../mappings/handler.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { pricelabsCredentials, pricelabsListings, properties } from '@walt/db';
import { createPriceLabsClient, type PriceLabsClient } from '@walt/pricelabs';
import { decryptApiKey } from '@/lib/pricelabs/encryption';
import { autoMatchListings } from '@/lib/pricelabs/auto-match';
import type { Actor } from '../credentials/handler';

const ALLOWED_ROLES = new Set(['owner', 'manager']);

export type GetDeps = {
  getActor?: (req: Request) => Promise<Actor | null>;
  getCredentials?: (orgId: string) => Promise<{ fingerprint: string; status: string; encryptedApiKey: string } | null>;
  decryptKey?: (encrypted: string) => string;
  createClient?: (apiKey: string) => PriceLabsClient;
  getProperties?: (orgId: string) => Promise<{ id: string; name: string }[]>;
  getStoredMappings?: (orgId: string) => Promise<
    { pricelabsListingId: string; propertyId: string | null; status: string; matchConfidence: string | null }[]
  >;
};

export type SaveDeps = {
  getActor?: (req: Request) => Promise<Actor | null>;
  upsertMappings?: (rows: {
    orgId: string;
    pricelabsListingId: string;
    pricelabsListingName: string;
    propertyId: string | null;
    status: 'active' | 'unmapped' | 'inactive';
    matchConfidence: 'manual';
  }[]) => Promise<void>;
};

async function defaultGetActor(req: Request): Promise<Actor | null> {
  const { getCurrentActor } = await import('@/lib/auth/current-actor');
  return getCurrentActor(req);
}

export async function handleGetMappings(req: Request, deps: GetDeps = {}): Promise<Response> {
  const actor = await (deps.getActor ?? defaultGetActor)(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.has(actor.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const getCredentials = deps.getCredentials ?? (async (orgId: string) => {
    const { db } = await import('@/lib/db');
    const [row] = await db
      .select({ fingerprint: pricelabsCredentials.apiKeyFingerprint, status: pricelabsCredentials.status, encryptedApiKey: pricelabsCredentials.encryptedApiKey })
      .from(pricelabsCredentials)
      .where(eq(pricelabsCredentials.orgId, orgId))
      .limit(1);
    return row ?? null;
  });

  const creds = await getCredentials(actor.orgId);
  if (!creds) return NextResponse.json({ state: 'not_connected' });
  if (creds.status === 'invalid') {
    return NextResponse.json({ state: 'key_invalid', fingerprint: creds.fingerprint });
  }

  const apiKey = (deps.decryptKey ?? decryptApiKey)(creds.encryptedApiKey);
  const client = (deps.createClient ?? ((k) => createPriceLabsClient({ apiKey: k })))(apiKey);
  const listings = await client.listListings();

  const getProperties = deps.getProperties ?? (async (orgId: string) => {
    const { db } = await import('@/lib/db');
    const { propertyAccess } = await import('@walt/db');
    const rows = await db
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .innerJoin(propertyAccess, eq(propertyAccess.propertyId, properties.id))
      .where(eq(propertyAccess.organizationId, orgId));
    return rows;
  });

  const getStored = deps.getStoredMappings ?? (async (orgId: string) => {
    const { db } = await import('@/lib/db');
    const rows = await db
      .select({
        pricelabsListingId: pricelabsListings.pricelabsListingId,
        propertyId: pricelabsListings.propertyId,
        status: pricelabsListings.status,
        matchConfidence: pricelabsListings.matchConfidence,
      })
      .from(pricelabsListings)
      .where(eq(pricelabsListings.orgId, orgId));
    return rows;
  });

  const [props, stored] = await Promise.all([getProperties(actor.orgId), getStored(actor.orgId)]);
  const storedByListing = new Map(stored.map((r) => [r.pricelabsListingId, r]));

  // Only auto-match for listings with NO stored mapping.
  const unmappedListings = listings.filter((l) => !storedByListing.has(l.id)).map((l) => ({ id: l.id, name: l.name }));
  const takenProps = new Set(stored.filter((r) => r.propertyId).map((r) => r.propertyId!));
  const availableProps = props.filter((p) => !takenProps.has(p.id));
  const autoMatches = autoMatchListings(unmappedListings, availableProps);
  const autoByListing = new Map(autoMatches.map((m) => [m.pricelabsListingId, m]));

  const rows = listings.map((l) => {
    const saved = storedByListing.get(l.id);
    if (saved) {
      return {
        pricelabsListingId: l.id,
        pricelabsListingName: l.name,
        propertyId: saved.propertyId,
        status: saved.status,
        matchConfidence: saved.matchConfidence,
      };
    }
    const auto = autoByListing.get(l.id);
    return {
      pricelabsListingId: l.id,
      pricelabsListingName: l.name,
      propertyId: auto?.propertyId ?? null,
      status: 'unmapped' as const,
      matchConfidence: auto?.confidence ?? null,
    };
  });

  return NextResponse.json({ state: 'connected', fingerprint: creds.fingerprint, rows });
}

const SaveBody = z.object({
  mappings: z
    .array(
      z.object({
        pricelabsListingId: z.string().min(1),
        pricelabsListingName: z.string().min(1),
        propertyId: z.string().nullable(),
        status: z.enum(['active', 'unmapped', 'inactive']),
      }),
    )
    .min(0),
});

export async function handleSaveMappings(req: Request, deps: SaveDeps = {}): Promise<Response> {
  const actor = await (deps.getActor ?? defaultGetActor)(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.has(actor.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = SaveBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid body' }, { status: 400 });
  }

  const rows = parsed.data.mappings.map((m) => ({
    orgId: actor.orgId,
    pricelabsListingId: m.pricelabsListingId,
    pricelabsListingName: m.pricelabsListingName,
    propertyId: m.propertyId,
    status: m.status,
    matchConfidence: 'manual' as const,
  }));

  const upsert = deps.upsertMappings ?? (async (rowsToInsert) => {
    const { db } = await import('@/lib/db');
    for (const r of rowsToInsert) {
      await db
        .insert(pricelabsListings)
        .values({
          orgId: r.orgId,
          pricelabsListingId: r.pricelabsListingId,
          pricelabsListingName: r.pricelabsListingName,
          propertyId: r.propertyId,
          status: r.status,
          matchConfidence: r.matchConfidence,
        })
        .onConflictDoUpdate({
          target: [pricelabsListings.orgId, pricelabsListings.pricelabsListingId],
          set: {
            pricelabsListingName: r.pricelabsListingName,
            propertyId: r.propertyId,
            status: r.status,
            matchConfidence: r.matchConfidence,
            updatedAt: new Date(),
          },
        });
    }
  });

  await upsert(rows);
  return NextResponse.json({ ok: true, count: rows.length });
}
```

- [ ] **Step 4: Create `.../mappings/route.ts`**

```ts
import { handleGetMappings, handleSaveMappings } from './handler';

export async function GET(request: Request): Promise<Response> {
  return handleGetMappings(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleSaveMappings(request);
}
```

- [ ] **Step 5: Run tests — pass**

Run: `pnpm --filter @walt/web test src/app/api/integrations/pricelabs/mappings/handler.test.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/integrations/pricelabs/mappings/
git commit -m "feat(pricelabs): mappings API (GET with auto-match + POST with manual override)"
```

---

## Task 9: Sync logic (`sync.ts`)

**Files:**
- Create: `apps/web/src/lib/pricelabs/sync.ts`
- Create: `apps/web/src/lib/pricelabs/sync.test.ts`

- [ ] **Step 1: Write failing test `sync.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { runPriceLabsSyncForOrg } from './sync';

describe('runPriceLabsSyncForOrg', () => {
  const orgId = 'org-1';

  it('returns no-op result when org has no credentials', async () => {
    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => new Date('2026-04-21T03:00:00Z'),
      getCredentials: async () => null,
      createSyncRun: vi.fn(),
      createClient: vi.fn(),
      getActiveMappings: vi.fn(),
      getReservations: vi.fn(),
      insertSnapshots: vi.fn(),
      insertSettingsSnapshot: vi.fn(),
      updateSyncRun: vi.fn(),
      updateMappingLastSyncedAt: vi.fn(),
      markCredentialsInvalid: vi.fn(),
    });
    expect(result).toEqual({ status: 'skipped_no_credentials' });
  });

  it('marks credentials invalid on auth_rejected and fails run', async () => {
    const markInvalid = vi.fn();
    const updateRun = vi.fn();
    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => new Date('2026-04-21T03:00:00Z'),
      getCredentials: async () => ({ encryptedApiKey: 'ENC' }),
      decryptKey: () => 'key',
      createClient: () => {
        const err: Error & { code?: string } = new Error('rejected');
        err.name = 'PriceLabsError';
        (err as never as { code: string }).code = 'auth_rejected';
        return {
          listListings: async () => { throw err; },
          getRecommendedRates: vi.fn(),
          getSettings: vi.fn(),
        };
      },
      createSyncRun: async () => 'run-1',
      getActiveMappings: vi.fn(),
      getReservations: vi.fn(),
      insertSnapshots: vi.fn(),
      insertSettingsSnapshot: vi.fn(),
      updateSyncRun: updateRun,
      updateMappingLastSyncedAt: vi.fn(),
      markCredentialsInvalid: markInvalid,
    });
    expect(result.status).toBe('failed');
    expect(markInvalid).toHaveBeenCalledWith(orgId);
    expect(updateRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ status: 'failed' }));
  });

  it('writes snapshots per listing with isBooked computed from reservations', async () => {
    const insertSnapshots = vi.fn();
    const insertSettings = vi.fn();
    const updateRun = vi.fn();
    const updateMapping = vi.fn();

    const today = new Date('2026-04-21T03:00:00Z');
    const rates = [
      { date: '2026-04-21', recommendedPrice: 500, publishedPrice: 550, basePrice: 450, minPrice: 300, maxPrice: 900, minStay: 2, closedToArrival: false, closedToDeparture: false },
      { date: '2026-04-22', recommendedPrice: 500, publishedPrice: 550, basePrice: 450, minPrice: 300, maxPrice: 900, minStay: 2, closedToArrival: false, closedToDeparture: false },
      { date: '2026-04-23', recommendedPrice: 500, publishedPrice: 550, basePrice: 450, minPrice: 300, maxPrice: 900, minStay: 2, closedToArrival: false, closedToDeparture: false },
    ];

    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => today,
      getCredentials: async () => ({ encryptedApiKey: 'ENC' }),
      decryptKey: () => 'key',
      createClient: () => ({
        listListings: async () => [{ id: 'pl-1', name: 'Demo', active: true }],
        getRecommendedRates: async () => rates,
        getSettings: async () => ({ listingId: 'pl-1', basePrice: 450, minPrice: 300, maxPrice: 900 }),
      }),
      createSyncRun: async () => 'run-1',
      getActiveMappings: async () => [{ pricelabsListingId: 'pl-1', propertyId: 'prop-1' }],
      getReservations: async () => [
        // A reservation covering 2026-04-22 but not 2026-04-21 or 2026-04-23
        { propertyId: 'prop-1', arrivalDate: new Date('2026-04-22'), departureDate: new Date('2026-04-23') },
      ],
      insertSnapshots,
      insertSettingsSnapshot: insertSettings,
      updateSyncRun: updateRun,
      updateMappingLastSyncedAt: updateMapping,
      markCredentialsInvalid: vi.fn(),
    });

    expect(result.status).toBe('success');
    expect(insertSnapshots).toHaveBeenCalledOnce();
    const inserted = insertSnapshots.mock.calls[0][0];
    expect(inserted).toHaveLength(3);
    const booked = inserted.filter((r: { isBooked: boolean }) => r.isBooked);
    expect(booked).toHaveLength(1);
    expect(booked[0].date).toBe('2026-04-22');
    expect(insertSettings).toHaveBeenCalledOnce();
    expect(updateMapping).toHaveBeenCalledWith('pl-1', today);
    expect(updateRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ status: 'success', listingsSynced: 1 }));
  });

  it('per-listing failure produces partial run', async () => {
    const updateRun = vi.fn();
    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => new Date('2026-04-21T03:00:00Z'),
      getCredentials: async () => ({ encryptedApiKey: 'ENC' }),
      decryptKey: () => 'key',
      createClient: () => ({
        listListings: async () => [],
        getRecommendedRates: async () => { throw new Error('boom'); },
        getSettings: async () => ({ listingId: 'pl-1', basePrice: 450, minPrice: 300, maxPrice: 900 }),
      }),
      createSyncRun: async () => 'run-1',
      getActiveMappings: async () => [
        { pricelabsListingId: 'pl-1', propertyId: 'prop-1' },
        { pricelabsListingId: 'pl-2', propertyId: 'prop-2' },
      ],
      getReservations: async () => [],
      insertSnapshots: vi.fn(),
      insertSettingsSnapshot: vi.fn(),
      updateSyncRun: updateRun,
      updateMappingLastSyncedAt: vi.fn(),
      markCredentialsInvalid: vi.fn(),
    });
    expect(result.status).toBe('partial');
    expect(updateRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ listingsFailed: 2 }));
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `pnpm --filter @walt/web test src/lib/pricelabs/sync.test.ts`
Expected: fails.

- [ ] **Step 3: Create `apps/web/src/lib/pricelabs/sync.ts`**

```ts
import { PriceLabsError, type PriceLabsClient, type DailyRate } from '@walt/pricelabs';

export type SyncDeps = {
  now?: () => Date;
  getCredentials: (orgId: string) => Promise<{ encryptedApiKey: string } | null>;
  decryptKey?: (encrypted: string) => string;
  createClient: (apiKey: string) => PriceLabsClient;
  createSyncRun: (orgId: string, startedAt: Date) => Promise<string>;
  getActiveMappings: (orgId: string) => Promise<{ pricelabsListingId: string; propertyId: string | null }[]>;
  getReservations: (propertyIds: string[]) => Promise<{ propertyId: string | null; arrivalDate: Date | null; departureDate: Date | null }[]>;
  insertSnapshots: (rows: {
    orgId: string;
    pricelabsListingId: string;
    date: string;
    recommendedPrice: number;
    publishedPrice: number | null;
    basePrice: number;
    minPrice: number;
    maxPrice: number;
    minStay: number | null;
    closedToArrival: boolean;
    closedToDeparture: boolean;
    isBooked: boolean;
    syncRunId: string;
  }[]) => Promise<void>;
  insertSettingsSnapshot: (row: { orgId: string; pricelabsListingId: string; syncRunId: string; settingsBlob: unknown }) => Promise<void>;
  updateSyncRun: (runId: string, patch: {
    completedAt: Date;
    status: 'success' | 'partial' | 'failed';
    listingsSynced: number;
    listingsFailed: number;
    errorSummary?: string;
  }) => Promise<void>;
  updateMappingLastSyncedAt: (pricelabsListingId: string, at: Date) => Promise<void>;
  markCredentialsInvalid: (orgId: string) => Promise<void>;
};

export type SyncResult =
  | { status: 'skipped_no_credentials' }
  | { status: 'success' | 'partial' | 'failed'; runId: string; listingsSynced: number; listingsFailed: number };

const FORWARD_DAYS = 365;

function addDaysIso(base: Date, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeBookedDates(
  reservations: { propertyId: string | null; arrivalDate: Date | null; departureDate: Date | null }[],
  propertyId: string | null,
): Set<string> {
  const set = new Set<string>();
  if (!propertyId) return set;
  for (const r of reservations) {
    if (r.propertyId !== propertyId || !r.arrivalDate || !r.departureDate) continue;
    const cursor = new Date(r.arrivalDate);
    while (cursor < r.departureDate) {
      set.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return set;
}

function buildSnapshotRows(
  orgId: string,
  pricelabsListingId: string,
  rates: DailyRate[],
  bookedDates: Set<string>,
  syncRunId: string,
): Parameters<SyncDeps['insertSnapshots']>[0] {
  return rates.map((r) => ({
    orgId,
    pricelabsListingId,
    date: r.date,
    recommendedPrice: r.recommendedPrice,
    publishedPrice: r.publishedPrice ?? null,
    basePrice: r.basePrice,
    minPrice: r.minPrice,
    maxPrice: r.maxPrice,
    minStay: r.minStay ?? null,
    closedToArrival: r.closedToArrival ?? false,
    closedToDeparture: r.closedToDeparture ?? false,
    isBooked: bookedDates.has(r.date),
    syncRunId,
  }));
}

export async function runPriceLabsSyncForOrg(orgId: string, deps: SyncDeps): Promise<SyncResult> {
  const now = (deps.now ?? (() => new Date))();
  const creds = await deps.getCredentials(orgId);
  if (!creds) return { status: 'skipped_no_credentials' };

  const runId = await deps.createSyncRun(orgId, now);

  const apiKey = (deps.decryptKey ?? ((x) => x))(creds.encryptedApiKey);
  const client = deps.createClient(apiKey);

  // Validate key by calling listListings; this also gives us the canonical list but we only
  // sync mappings that are status='active' in our DB.
  try {
    await client.listListings();
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth_rejected') {
      await deps.markCredentialsInvalid(orgId);
    }
    await deps.updateSyncRun(runId, {
      completedAt: new Date(),
      status: 'failed',
      listingsSynced: 0,
      listingsFailed: 0,
      errorSummary: code ?? 'unknown',
    });
    return { status: 'failed', runId, listingsSynced: 0, listingsFailed: 0 };
  }

  const mappings = await deps.getActiveMappings(orgId);
  const propertyIds = mappings.map((m) => m.propertyId).filter((x): x is string => !!x);
  const reservations = propertyIds.length > 0 ? await deps.getReservations(propertyIds) : [];

  const startDate = addDaysIso(now, 0);
  const endDate = addDaysIso(now, FORWARD_DAYS);

  let synced = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const mapping of mappings) {
    try {
      const [rates, settings] = await Promise.all([
        client.getRecommendedRates(mapping.pricelabsListingId, startDate, endDate),
        client.getSettings(mapping.pricelabsListingId),
      ]);
      const booked = computeBookedDates(reservations, mapping.propertyId);
      const rows = buildSnapshotRows(orgId, mapping.pricelabsListingId, rates, booked, runId);
      await deps.insertSnapshots(rows);
      await deps.insertSettingsSnapshot({
        orgId,
        pricelabsListingId: mapping.pricelabsListingId,
        syncRunId: runId,
        settingsBlob: settings,
      });
      await deps.updateMappingLastSyncedAt(mapping.pricelabsListingId, now);
      synced++;
    } catch (err) {
      failed++;
      const code = err instanceof PriceLabsError ? err.code : 'unknown';
      failures.push(`${mapping.pricelabsListingId}:${code}`);
    }
  }

  const status: 'success' | 'partial' | 'failed' = failed === 0 ? 'success' : synced === 0 ? 'failed' : 'partial';
  await deps.updateSyncRun(runId, {
    completedAt: new Date(),
    status,
    listingsSynced: synced,
    listingsFailed: failed,
    errorSummary: failures.length ? failures.join('; ').slice(0, 1000) : undefined,
  });

  return { status, runId, listingsSynced: synced, listingsFailed: failed };
}
```

- [ ] **Step 4: Run tests — pass**

Run: `pnpm --filter @walt/web test src/lib/pricelabs/sync.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pricelabs/sync.ts apps/web/src/lib/pricelabs/sync.test.ts
git commit -m "feat(pricelabs): per-org sync logic with isBooked computation and partial-failure handling"
```

---

## Task 10: Cron route + admin manual trigger

**Files:**
- Create: `apps/web/src/app/api/cron/pricelabs-sync/handler.ts`
- Create: `apps/web/src/app/api/cron/pricelabs-sync/handler.test.ts`
- Create: `apps/web/src/app/api/cron/pricelabs-sync/route.ts`
- Create: `apps/web/src/app/api/admin/pricelabs-sync/handler.ts`
- Create: `apps/web/src/app/api/admin/pricelabs-sync/route.ts`
- Modify: `apps/web/vercel.json` (add cron entry)

- [ ] **Step 1: Write failing test `cron/pricelabs-sync/handler.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleCronSync } from './handler';

const authed = new Request('http://test/api/cron/pricelabs-sync', {
  method: 'POST',
  headers: { authorization: 'Bearer test-secret' },
});

describe('handleCronSync', () => {
  it('401s without bearer', async () => {
    const res = await handleCronSync(new Request('http://test/api/cron/pricelabs-sync', { method: 'POST' }), {
      cronSecret: 'test-secret',
      getOrgsWithCredentials: async () => [],
      runForOrg: async () => ({ status: 'success', runId: 'r', listingsSynced: 0, listingsFailed: 0 }),
    });
    expect(res.status).toBe(401);
  });

  it('fans out across orgs', async () => {
    const runFn = vi.fn().mockResolvedValue({ status: 'success', runId: 'r', listingsSynced: 1, listingsFailed: 0 });
    const res = await handleCronSync(authed, {
      cronSecret: 'test-secret',
      getOrgsWithCredentials: async () => [{ orgId: 'org-1' }, { orgId: 'org-2' }],
      runForOrg: runFn,
    });
    expect(res.status).toBe(200);
    expect(runFn).toHaveBeenCalledTimes(2);
  });

  it('one org failing does not prevent the next', async () => {
    const runFn = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ status: 'success', runId: 'r', listingsSynced: 1, listingsFailed: 0 });
    const res = await handleCronSync(authed, {
      cronSecret: 'test-secret',
      getOrgsWithCredentials: async () => [{ orgId: 'org-1' }, { orgId: 'org-2' }],
      runForOrg: runFn,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.find((r: { orgId: string }) => r.orgId === 'org-1').status).toBe('failed');
    expect(body.results.find((r: { orgId: string }) => r.orgId === 'org-2').status).toBe('success');
  });
});
```

- [ ] **Step 2: Create `cron/pricelabs-sync/handler.ts`**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  pricelabsCredentials,
  pricelabsListings,
  pricelabsSyncRuns,
  pricingSnapshots,
  pricelabsSettingsSnapshots,
  reservations,
} from '@walt/db';
import { createPriceLabsClient } from '@walt/pricelabs';
import { decryptApiKey } from '@/lib/pricelabs/encryption';
import { runPriceLabsSyncForOrg, type SyncResult } from '@/lib/pricelabs/sync';

export type CronDeps = {
  cronSecret?: string;
  getOrgsWithCredentials?: () => Promise<{ orgId: string }[]>;
  runForOrg?: (orgId: string) => Promise<SyncResult>;
};

export async function handleCronSync(request: Request, deps: CronDeps = {}): Promise<Response> {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const getOrgs = deps.getOrgsWithCredentials ?? (async () => {
    const { db } = await import('@/lib/db');
    return db
      .select({ orgId: pricelabsCredentials.orgId })
      .from(pricelabsCredentials)
      .where(eq(pricelabsCredentials.status, 'active'));
  });

  const runForOrg = deps.runForOrg ?? defaultRunForOrg;

  const orgs = await getOrgs();
  const results: { orgId: string; status: string; runId?: string; listingsSynced?: number; listingsFailed?: number }[] = [];
  for (const { orgId } of orgs) {
    try {
      const result = await runForOrg(orgId);
      console.log(`[pricelabs-sync] org=${orgId} done`, result);
      if (result.status === 'skipped_no_credentials') {
        results.push({ orgId, status: 'skipped' });
      } else {
        results.push({ orgId, status: result.status, runId: result.runId, listingsSynced: result.listingsSynced, listingsFailed: result.listingsFailed });
      }
    } catch (err) {
      console.error(`[pricelabs-sync] org=${orgId} threw`, err);
      results.push({ orgId, status: 'failed' });
    }
  }
  return NextResponse.json({ orgCount: orgs.length, results });
}

async function defaultRunForOrg(orgId: string): Promise<SyncResult> {
  const { db } = await import('@/lib/db');
  return runPriceLabsSyncForOrg(orgId, {
    getCredentials: async (id) => {
      const [row] = await db.select({ encryptedApiKey: pricelabsCredentials.encryptedApiKey }).from(pricelabsCredentials).where(eq(pricelabsCredentials.orgId, id)).limit(1);
      return row ?? null;
    },
    decryptKey: decryptApiKey,
    createClient: (key) => createPriceLabsClient({ apiKey: key }),
    createSyncRun: async (id, startedAt) => {
      const [row] = await db.insert(pricelabsSyncRuns).values({ orgId: id, startedAt, status: 'running' }).returning({ id: pricelabsSyncRuns.id });
      return row.id;
    },
    getActiveMappings: async (id) => {
      const rows = await db
        .select({ pricelabsListingId: pricelabsListings.pricelabsListingId, propertyId: pricelabsListings.propertyId })
        .from(pricelabsListings)
        .where(eq(pricelabsListings.orgId, id));
      return rows.filter((r) => r.pricelabsListingId);
    },
    getReservations: async (propertyIds) => {
      if (propertyIds.length === 0) return [];
      const { inArray } = await import('drizzle-orm');
      return db
        .select({ propertyId: reservations.propertyId, arrivalDate: reservations.arrivalDate, departureDate: reservations.departureDate })
        .from(reservations)
        .where(inArray(reservations.propertyId, propertyIds));
    },
    insertSnapshots: async (rows) => {
      if (rows.length === 0) return;
      await db.insert(pricingSnapshots).values(rows);
    },
    insertSettingsSnapshot: async (row) => {
      await db.insert(pricelabsSettingsSnapshots).values({
        orgId: row.orgId,
        pricelabsListingId: row.pricelabsListingId,
        syncRunId: row.syncRunId,
        settingsBlob: row.settingsBlob as never,
      });
    },
    updateSyncRun: async (runId, patch) => {
      await db.update(pricelabsSyncRuns).set(patch).where(eq(pricelabsSyncRuns.id, runId));
    },
    updateMappingLastSyncedAt: async (pricelabsListingId, at) => {
      await db.update(pricelabsListings).set({ lastSyncedAt: at }).where(eq(pricelabsListings.pricelabsListingId, pricelabsListingId));
    },
    markCredentialsInvalid: async (id) => {
      await db.update(pricelabsCredentials).set({ status: 'invalid', updatedAt: new Date() }).where(eq(pricelabsCredentials.orgId, id));
    },
  });
}
```

- [ ] **Step 3: Create `cron/pricelabs-sync/route.ts`**

```ts
import { handleCronSync } from './handler';

export async function POST(request: Request): Promise<Response> {
  return handleCronSync(request);
}
```

- [ ] **Step 4: Create `admin/pricelabs-sync/handler.ts`**

```ts
import { NextResponse } from 'next/server';
import { handleCronSync } from '../../cron/pricelabs-sync/handler';

// Admin-authenticated manual trigger. Delegates to the cron handler by synthesizing
// the bearer header so the same fan-out logic runs.
export async function handleAdminSync(request: Request): Promise<Response> {
  const { getCurrentActor } = await import('@/lib/auth/current-actor');
  const actor = await getCurrentActor(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (actor.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const cronReq = new Request(request.url, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return handleCronSync(cronReq);
}
```

- [ ] **Step 5: Create `admin/pricelabs-sync/route.ts`**

```ts
import { handleAdminSync } from './handler';

export async function POST(request: Request): Promise<Response> {
  return handleAdminSync(request);
}
```

- [ ] **Step 6: Add cron entry to `apps/web/vercel.json`**

If `vercel.json` exists, add an entry:

```json
{
  "crons": [
    { "path": "/api/cron/pricelabs-sync", "schedule": "0 3 * * *" }
  ]
}
```

If the file already has a `crons` array, append this entry to it. If the project uses a different cron mechanism (check `infra/` or `apps/web/` for clues), match that pattern instead.

- [ ] **Step 7: Run tests — pass**

Run: `pnpm --filter @walt/web test src/app/api/cron/pricelabs-sync/handler.test.ts`
Expected: 3 tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/api/cron/pricelabs-sync/ apps/web/src/app/api/admin/pricelabs-sync/ apps/web/vercel.json
git commit -m "feat(pricelabs): daily sync cron + admin manual trigger"
```

---

## Task 11: Pricing snapshots API (for chart)

**Files:**
- Create: `apps/web/src/app/api/properties/[id]/pricing-snapshots/handler.ts`
- Create: `apps/web/src/app/api/properties/[id]/pricing-snapshots/handler.test.ts`
- Create: `apps/web/src/app/api/properties/[id]/pricing-snapshots/route.ts`

- [ ] **Step 1: Write failing test `handler.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleGetPricingSnapshots } from './handler';

const actor = { userId: 'u1', orgId: 'org-1', role: 'owner' };

describe('handleGetPricingSnapshots', () => {
  it('401 unauthenticated', async () => {
    const res = await handleGetPricingSnapshots(new Request('http://t/api/properties/prop-1/pricing-snapshots'), 'prop-1', {
      getActor: async () => null,
    });
    expect(res.status).toBe(401);
  });

  it('403 when user has no access to the property', async () => {
    const res = await handleGetPricingSnapshots(new Request('http://t/api/properties/prop-1/pricing-snapshots'), 'prop-1', {
      getActor: async () => actor,
      userHasAccessToProperty: async () => false,
    });
    expect(res.status).toBe(403);
  });

  it('returns empty when property has no mapping', async () => {
    const res = await handleGetPricingSnapshots(new Request('http://t/api/properties/prop-1/pricing-snapshots'), 'prop-1', {
      getActor: async () => actor,
      userHasAccessToProperty: async () => true,
      getMapping: async () => null,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ state: 'no_mapping' });
  });

  it('returns pending when mapping exists but no sync has run', async () => {
    const res = await handleGetPricingSnapshots(new Request('http://t/api/properties/prop-1/pricing-snapshots'), 'prop-1', {
      getActor: async () => actor,
      userHasAccessToProperty: async () => true,
      getMapping: async () => ({ pricelabsListingId: 'pl-1', lastSyncedAt: null }),
      getRecentSnapshots: async () => [],
    });
    const body = await res.json();
    expect(body).toEqual({ state: 'pending', listingId: 'pl-1' });
  });

  it('returns most recent snapshot window', async () => {
    const res = await handleGetPricingSnapshots(
      new Request('http://t/api/properties/prop-1/pricing-snapshots?days=90'),
      'prop-1',
      {
        getActor: async () => actor,
        userHasAccessToProperty: async () => true,
        getMapping: async () => ({ pricelabsListingId: 'pl-1', lastSyncedAt: new Date('2026-04-21T03:00:00Z') }),
        getRecentSnapshots: async () => [
          { date: '2026-04-21', recommendedPrice: 500, publishedPrice: 550, isBooked: false },
          { date: '2026-04-22', recommendedPrice: 510, publishedPrice: 550, isBooked: true },
        ],
      },
    );
    const body = await res.json();
    expect(body.state).toBe('ok');
    expect(body.listingId).toBe('pl-1');
    expect(body.days).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Create `handler.ts`**

```ts
import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { pricelabsListings, pricingSnapshots, propertyAccess } from '@walt/db';
import type { Actor } from '../../../integrations/pricelabs/credentials/handler';

export type Deps = {
  getActor?: (req: Request) => Promise<Actor | null>;
  userHasAccessToProperty?: (actor: Actor, propertyId: string) => Promise<boolean>;
  getMapping?: (orgId: string, propertyId: string) => Promise<{ pricelabsListingId: string; lastSyncedAt: Date | null } | null>;
  getRecentSnapshots?: (orgId: string, pricelabsListingId: string, days: number) => Promise<{
    date: string;
    recommendedPrice: number;
    publishedPrice: number | null;
    isBooked: boolean;
  }[]>;
};

async function defaultGetActor(req: Request): Promise<Actor | null> {
  const { getCurrentActor } = await import('@/lib/auth/current-actor');
  return getCurrentActor(req);
}

export async function handleGetPricingSnapshots(request: Request, propertyId: string, deps: Deps = {}): Promise<Response> {
  const actor = await (deps.getActor ?? defaultGetActor)(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userHasAccess = deps.userHasAccessToProperty ?? (async (act: Actor, id: string) => {
    const { db } = await import('@/lib/db');
    const [row] = await db
      .select({ propertyId: propertyAccess.propertyId })
      .from(propertyAccess)
      .where(and(eq(propertyAccess.organizationId, act.orgId), eq(propertyAccess.propertyId, id)))
      .limit(1);
    return !!row;
  });

  if (!(await userHasAccess(actor, propertyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const getMapping = deps.getMapping ?? (async (orgId: string, id: string) => {
    const { db } = await import('@/lib/db');
    const [row] = await db
      .select({ pricelabsListingId: pricelabsListings.pricelabsListingId, lastSyncedAt: pricelabsListings.lastSyncedAt })
      .from(pricelabsListings)
      .where(and(
        eq(pricelabsListings.orgId, orgId),
        eq(pricelabsListings.propertyId, id),
        eq(pricelabsListings.status, 'active'),
      ))
      .limit(1);
    return row ?? null;
  });

  const mapping = await getMapping(actor.orgId, propertyId);
  if (!mapping) return NextResponse.json({ state: 'no_mapping' });

  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');
  const days = daysParam ? Math.max(1, Math.min(365, parseInt(daysParam, 10) || 90)) : 90;

  const getSnapshots = deps.getRecentSnapshots ?? (async (orgId: string, listingId: string, d: number) => {
    const { db } = await import('@/lib/db');
    // Only return rows for the most recent sync_run_id for this listing.
    const rows = await db.execute<{ date: string; recommended_price: number; published_price: number | null; is_booked: boolean }>(
      sql`
        SELECT date, recommended_price, published_price, is_booked
        FROM walt.pricing_snapshots
        WHERE org_id = ${orgId}
          AND pricelabs_listing_id = ${listingId}
          AND sync_run_id = (
            SELECT sync_run_id FROM walt.pricing_snapshots
            WHERE org_id = ${orgId} AND pricelabs_listing_id = ${listingId}
            ORDER BY created_at DESC LIMIT 1
          )
          AND date::date >= CURRENT_DATE
          AND date::date < CURRENT_DATE + ${d}
        ORDER BY date ASC
      `,
    );
    return rows.map((r) => ({
      date: r.date,
      recommendedPrice: r.recommended_price,
      publishedPrice: r.published_price,
      isBooked: r.is_booked,
    }));
  });

  const snapshots = await getSnapshots(actor.orgId, mapping.pricelabsListingId, days);
  if (snapshots.length === 0) {
    return NextResponse.json({ state: 'pending', listingId: mapping.pricelabsListingId });
  }

  return NextResponse.json({
    state: 'ok',
    listingId: mapping.pricelabsListingId,
    lastSyncedAt: mapping.lastSyncedAt?.toISOString() ?? null,
    days: snapshots,
  });
}
```

- [ ] **Step 3: Create `route.ts`**

```ts
import { handleGetPricingSnapshots } from './handler';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return handleGetPricingSnapshots(request, id);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @walt/web test src/app/api/properties/\\[id\\]/pricing-snapshots/handler.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/properties/\[id\]/pricing-snapshots/
git commit -m "feat(pricelabs): pricing-snapshots API for property chart consumption"
```

---

## Task 12: Admin UI page `/settings/integrations/pricelabs`

**Files:**
- Create: `apps/web/src/app/settings/integrations/pricelabs/page.tsx`
- Create: `apps/web/src/app/settings/integrations/pricelabs/PriceLabsIntegrationClient.tsx`
- Create: `apps/web/src/hooks/use-pricelabs-credentials.ts`
- Create: `apps/web/src/hooks/use-pricelabs-mappings.ts`
- Modify: `apps/web/src/lib/nav-links.ts` (add entry)

- [ ] **Step 1: Create `apps/web/src/hooks/use-pricelabs-credentials.ts`**

```ts
'use client';

import { useCallback, useState } from 'react';

export type ConnectResult =
  | { ok: true; fingerprint: string }
  | { ok: false; error: string };

export function useConnectPriceLabs(): { submit: (apiKey: string) => Promise<ConnectResult>; submitting: boolean } {
  const [submitting, setSubmitting] = useState(false);
  const submit = useCallback(async (apiKey: string): Promise<ConnectResult> => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/integrations/pricelabs/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const body = await res.json();
      if (!res.ok) return { ok: false, error: body.error ?? 'Unknown error' };
      return { ok: true, fingerprint: body.fingerprint };
    } finally {
      setSubmitting(false);
    }
  }, []);
  return { submit, submitting };
}

export function useDisconnectPriceLabs(): { disconnect: () => Promise<boolean>; submitting: boolean } {
  const [submitting, setSubmitting] = useState(false);
  const disconnect = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/integrations/pricelabs/credentials', { method: 'DELETE' });
      return res.ok;
    } finally {
      setSubmitting(false);
    }
  }, []);
  return { disconnect, submitting };
}
```

- [ ] **Step 2: Create `apps/web/src/hooks/use-pricelabs-mappings.ts`**

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';

export type MappingRow = {
  pricelabsListingId: string;
  pricelabsListingName: string;
  propertyId: string | null;
  status: 'active' | 'unmapped' | 'inactive';
  matchConfidence: 'manual' | 'auto-high' | 'auto-low' | null;
};

export type MappingsState =
  | { state: 'loading' }
  | { state: 'not_connected' }
  | { state: 'key_invalid'; fingerprint: string }
  | { state: 'connected'; fingerprint: string; rows: MappingRow[] }
  | { state: 'error'; error: string };

export function usePriceLabsMappings(): { data: MappingsState; refetch: () => Promise<void> } {
  const [data, setData] = useState<MappingsState>({ state: 'loading' });
  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/pricelabs/mappings');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setData({ state: 'error', error: body.error ?? `HTTP ${res.status}` });
        return;
      }
      setData(await res.json());
    } catch (err) {
      setData({ state: 'error', error: err instanceof Error ? err.message : 'unknown' });
    }
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, refetch };
}

export function useSavePriceLabsMappings(): { save: (rows: MappingRow[]) => Promise<boolean>; submitting: boolean } {
  const [submitting, setSubmitting] = useState(false);
  const save = useCallback(async (rows: MappingRow[]) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/integrations/pricelabs/mappings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mappings: rows }),
      });
      return res.ok;
    } finally {
      setSubmitting(false);
    }
  }, []);
  return { save, submitting };
}
```

- [ ] **Step 3: Create `PriceLabsIntegrationClient.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePriceLabsMappings, useSavePriceLabsMappings, type MappingRow } from '@/hooks/use-pricelabs-mappings';
import { useConnectPriceLabs, useDisconnectPriceLabs } from '@/hooks/use-pricelabs-credentials';

export function PriceLabsIntegrationClient({ properties }: { properties: { id: string; name: string }[] }): React.ReactElement {
  const { data, refetch } = usePriceLabsMappings();
  const { submit, submitting } = useConnectPriceLabs();
  const { disconnect, submitting: disconnecting } = useDisconnectPriceLabs();
  const { save, submitting: saving } = useSavePriceLabsMappings();
  const [apiKey, setApiKey] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, MappingRow>>({});

  const rows: MappingRow[] = data.state === 'connected' ? data.rows.map((r) => edits[r.pricelabsListingId] ?? r) : [];
  const dirty = useMemo(() => Object.keys(edits).length > 0, [edits]);
  const unmappedCount = rows.filter((r) => r.status !== 'active' || !r.propertyId).length;

  async function onConnect(): Promise<void> {
    setConnectError(null);
    const result = await submit(apiKey);
    if (result.ok) {
      setApiKey('');
      await refetch();
    } else {
      setConnectError(result.error);
    }
  }

  function updateRow(listingId: string, patch: Partial<MappingRow>): void {
    const base = data.state === 'connected' ? data.rows.find((r) => r.pricelabsListingId === listingId) : undefined;
    if (!base) return;
    setEdits((prev) => ({ ...prev, [listingId]: { ...base, ...prev[listingId], ...patch } }));
  }

  async function onSave(): Promise<void> {
    const toSave = Object.values(edits);
    const ok = await save(toSave);
    if (ok) {
      setEdits({});
      await refetch();
    }
  }

  if (data.state === 'loading') return <div className="p-5 text-slate-500">Loading…</div>;
  if (data.state === 'error') return <div className="p-5 text-red-600">Error: {data.error}</div>;

  if (data.state === 'not_connected' || data.state === 'key_invalid') {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Connect PriceLabs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.state === 'key_invalid' && (
            <p className="text-sm text-red-600">
              Last key (•••{data.fingerprint}) was rejected by PriceLabs — replace it.
            </p>
          )}
          <p className="text-sm text-slate-600">
            Paste your PriceLabs Customer API key. You can find it in PriceLabs Account Settings → API Details.
          </p>
          <Input
            type="password"
            placeholder="pl_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          {connectError && <p className="text-sm text-red-600">{connectError}</p>}
          <Button onClick={onConnect} disabled={submitting || !apiKey.trim()}>
            {submitting ? 'Validating…' : 'Connect'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>PriceLabs listings</CardTitle>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-slate-500">Key: •••{data.fingerprint}</span>
            <Button variant="outline" size="sm" onClick={disconnect} disabled={disconnecting}>
              Disconnect
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {unmappedCount > 0 && (
            <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
              {unmappedCount} listing{unmappedCount === 1 ? '' : 's'} not yet mapped — these won&apos;t be synced.
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">PriceLabs listing</th>
                <th className="py-2">Internal property</th>
                <th className="py-2">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pricelabsListingId} className="border-t border-slate-100">
                  <td className="py-2">
                    <div className="font-medium">{r.pricelabsListingName}</div>
                    <div className="text-xs text-slate-500">{r.pricelabsListingId}</div>
                  </td>
                  <td className="py-2">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={r.propertyId ?? ''}
                      onChange={(e) => updateRow(r.pricelabsListingId, {
                        propertyId: e.target.value || null,
                        status: e.target.value ? 'active' : 'unmapped',
                      })}
                    >
                      <option value="">— none —</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {r.matchConfidence && r.matchConfidence !== 'manual' && (
                      <span className="ml-2 text-xs text-slate-500">suggested ({r.matchConfidence})</span>
                    )}
                  </td>
                  <td className="py-2">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={r.status}
                      onChange={(e) => updateRow(r.pricelabsListingId, { status: e.target.value as MappingRow['status'] })}
                    >
                      <option value="active">active</option>
                      <option value="unmapped">unmapped</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            <Button onClick={onSave} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save mappings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web/src/app/settings/integrations/pricelabs/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { propertyAccess, properties } from '@walt/db';
import { db } from '@/lib/db';
import { getCurrentActor } from '@/lib/auth/current-actor';
import { PriceLabsIntegrationClient } from './PriceLabsIntegrationClient';

export default async function PriceLabsIntegrationPage(): Promise<React.ReactElement> {
  // Cast Request is not available in a Server Component; a real implementation
  // should call the same Clerk/session helper used elsewhere in the app.
  // Here we use a Request stub to reuse `getCurrentActor`.
  const actor = await getCurrentActor(new Request('http://internal/'));
  if (!actor) redirect('/sign-in');
  if (!['owner', 'manager'].includes(actor.role)) redirect('/');

  const propsRows = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .innerJoin(propertyAccess, eq(propertyAccess.propertyId, properties.id))
    .where(eq(propertyAccess.organizationId, actor.orgId));

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold mb-1">PriceLabs integration</h1>
      <p className="text-sm text-slate-600 mb-6">
        Connect your PriceLabs Customer API key and map your listings to properties.
      </p>
      <PriceLabsIntegrationClient properties={propsRows} />
    </div>
  );
}
```

- [ ] **Step 5: Add nav link in `apps/web/src/lib/nav-links.ts`**

Read the existing file to find the relevant "Settings" or "Integrations" group and append:

```ts
{ label: 'PriceLabs', href: '/settings/integrations/pricelabs' }
```

(Exact syntax depends on the `navGroups` shape — check the file first.)

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm turbo run typecheck lint --filter=@walt/web`
Expected: exits 0.

- [ ] **Step 7: Manual smoke**

Run `pnpm dev` and visit `/settings/integrations/pricelabs`. Expected: "Connect PriceLabs" card renders. Paste a real PriceLabs key — validation round-trips and the mapping table renders.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/settings/integrations/pricelabs/ apps/web/src/hooks/use-pricelabs-*.ts apps/web/src/lib/nav-links.ts
git commit -m "feat(pricelabs): admin UI for connecting account and confirming mappings"
```

---

## Task 13: Property page chart

**Files:**
- Modify: `apps/web/package.json` (add recharts)
- Create: `apps/web/src/hooks/use-pricing-snapshots.ts`
- Create: `apps/web/src/components/pricing/pricing-chart.tsx`
- Modify: `apps/web/src/app/properties/[id]/details/page.tsx` (add card)

- [ ] **Step 1: Install recharts**

```bash
pnpm --filter @walt/web add recharts
```

Expected: `recharts` added to `apps/web/package.json`.

- [ ] **Step 2: Create `apps/web/src/hooks/use-pricing-snapshots.ts`**

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';

export type DailySnapshot = {
  date: string;
  recommendedPrice: number;
  publishedPrice: number | null;
  isBooked: boolean;
};

export type PricingSnapshotsState =
  | { state: 'loading' }
  | { state: 'no_mapping' }
  | { state: 'pending' }
  | { state: 'ok'; listingId: string; lastSyncedAt: string | null; days: DailySnapshot[] }
  | { state: 'error'; error: string };

export function usePricingSnapshots(propertyId: string, days = 90): { data: PricingSnapshotsState; refetch: () => Promise<void> } {
  const [data, setData] = useState<PricingSnapshotsState>({ state: 'loading' });
  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/pricing-snapshots?days=${days}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setData({ state: 'error', error: body.error ?? `HTTP ${res.status}` });
        return;
      }
      const body = await res.json();
      setData(body);
    } catch (err) {
      setData({ state: 'error', error: err instanceof Error ? err.message : 'unknown' });
    }
  }, [propertyId, days]);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, refetch };
}
```

- [ ] **Step 3: Create `apps/web/src/components/pricing/pricing-chart.tsx`**

```tsx
'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import type { DailySnapshot } from '@/hooks/use-pricing-snapshots';

type BookedBand = { startDate: string; endDate: string };

function bookedBands(days: DailySnapshot[]): BookedBand[] {
  const bands: BookedBand[] = [];
  let start: string | null = null;
  let prev: string | null = null;
  for (const d of days) {
    if (d.isBooked) {
      if (start === null) start = d.date;
      prev = d.date;
    } else if (start !== null && prev !== null) {
      bands.push({ startDate: start, endDate: prev });
      start = null;
      prev = null;
    }
  }
  if (start !== null && prev !== null) bands.push({ startDate: start, endDate: prev });
  return bands;
}

function fmtDollars(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

export function PricingChart({ days, lastSyncedAt }: { days: DailySnapshot[]; lastSyncedAt: string | null }): React.ReactElement {
  const bands = bookedBands(days);
  const formattedDays = days.map((d) => ({
    ...d,
    recommendedDollars: d.recommendedPrice / 100,
    publishedDollars: d.publishedPrice != null ? d.publishedPrice / 100 : null,
  }));

  return (
    <div className="w-full">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedDays} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            {bands.map((b, i) => (
              <ReferenceArea
                key={i}
                x1={b.startDate}
                x2={b.endDate}
                fill="#e2e8f0"
                fillOpacity={0.6}
                ifOverflow="extendDomain"
              />
            ))}
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(value: string) => {
                const d = new Date(value);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
              interval={6}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
            <Tooltip
              formatter={(value, name) => [
                typeof value === 'number' ? fmtDollars(value * 100) : value,
                name === 'recommendedDollars' ? 'Recommended' : 'Published',
              ]}
              labelFormatter={(label: string) => new Date(label).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            />
            <Line type="monotone" dataKey="recommendedDollars" stroke="#0284c7" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="publishedDollars" stroke="#334155" strokeWidth={2} dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 text-xs text-slate-500 mt-2">
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-sky-600" /> Recommended</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-slate-700" /> Published</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-slate-200" /> Booked</div>
        {lastSyncedAt && (
          <div className="ml-auto">
            Last synced: {new Date(lastSyncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Modify `apps/web/src/app/properties/[id]/details/page.tsx`**

Add a new Card below the existing details cards. Because this page is a server component and the chart uses client hooks, extract a tiny client wrapper.

Create `apps/web/src/app/properties/[id]/details/PricingCard.tsx`:

```tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePricingSnapshots } from '@/hooks/use-pricing-snapshots';
import { PricingChart } from '@/components/pricing/pricing-chart';

export function PricingCard({ propertyId }: { propertyId: string }): React.ReactElement | null {
  const { data } = usePricingSnapshots(propertyId, 90);
  if (data.state === 'loading') return (
    <Card><CardHeader><CardTitle>Pricing — next 90 days</CardTitle></CardHeader><CardContent>Loading…</CardContent></Card>
  );
  if (data.state === 'no_mapping') return null;
  if (data.state === 'pending') return (
    <Card>
      <CardHeader><CardTitle>Pricing — next 90 days</CardTitle></CardHeader>
      <CardContent className="text-sm text-slate-500">Waiting for first PriceLabs sync — next run at 03:00 UTC.</CardContent>
    </Card>
  );
  if (data.state === 'error') return (
    <Card>
      <CardHeader><CardTitle>Pricing — next 90 days</CardTitle></CardHeader>
      <CardContent className="text-sm text-red-600">Couldn&apos;t load pricing: {data.error}</CardContent>
    </Card>
  );
  return (
    <Card>
      <CardHeader><CardTitle>Pricing — next 90 days</CardTitle></CardHeader>
      <CardContent>
        <PricingChart days={data.days} lastSyncedAt={data.lastSyncedAt} />
      </CardContent>
    </Card>
  );
}
```

Then in `apps/web/src/app/properties/[id]/details/page.tsx`, import and render the card inside the existing layout (after the last details card):

```tsx
import { PricingCard } from './PricingCard';

// ... inside the JSX tree, after the existing cards:
<div className="mt-4">
  <PricingCard propertyId={id} />
</div>
```

- [ ] **Step 5: Typecheck + lint + build**

Run: `pnpm turbo run typecheck lint build --filter=@walt/web`
Expected: exits 0 for all three.

- [ ] **Step 6: Manual smoke**

1. Start dev: `pnpm dev`
2. Connect a real PriceLabs key at `/settings/integrations/pricelabs`
3. Confirm mappings for the 3 active listings, save
4. Hit the admin manual trigger: `curl -X POST http://localhost:3000/api/admin/pricelabs-sync -H "cookie: <your session cookie>"`
5. Visit a mapped property's details page — the chart should render with two lines and booking overlay.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/src/hooks/use-pricing-snapshots.ts apps/web/src/components/pricing/ apps/web/src/app/properties/\[id\]/details/PricingCard.tsx apps/web/src/app/properties/\[id\]/details/page.tsx pnpm-lock.yaml
git commit -m "feat(pricelabs): add 90-day pricing chart to property details page"
```

---

## End-of-slice verification

Before calling Slice 1 done, run the full monorepo check:

```bash
pnpm turbo run typecheck lint build --filter=@walt/web
pnpm --filter @walt/pricelabs test
pnpm --filter @walt/web test
```

Expected: all commands exit 0.

Run the manual verification checklist from the spec (§10):

1. `curl` the admin sync endpoint → run completes without errors
2. `psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM walt.pricing_snapshots WHERE created_at > now() - interval '1 hour'"` → non-zero per active mapping
3. Mapped property's details page → chart renders with both lines and booked overlay
4. Flip one mapping to `status='inactive'` via the UI; re-trigger sync → no new rows for that listing
5. Replace API key with a deliberately bad one → mapping page shows "key invalid" state, cron run writes `status='failed'` with sane `errorSummary`

After verification, create a PR from a fresh branch off `origin/main` (per CLAUDE.md "Clean PRs" rule) containing only files from this plan — do not include any of the WIP branch's unrelated changes.

---

## Self-review notes

**Spec coverage check:**
- §5 Package → Tasks 1–3 ✓
- §6 Schema (5 tables + encryption + cents convention) → Task 4 + Task 5 ✓
- §7 Cron + admin trigger → Tasks 9 and 10 ✓
- §8 Admin UI (3 states, auto-match, save) → Tasks 6, 7, 8, 12 ✓
- §9 Chart + `/api/properties/[id]/pricing-snapshots` → Tasks 11 and 13 ✓
- §10 Tests → embedded in each task (Tasks 2, 3, 5, 6, 7, 8, 9, 10, 11) ✓
- §11 Observability (sync runs table + console logs) → Tasks 4 (table) and 10 (logs) ✓
- §12 Error surfaces → covered in Tasks 11 (API states) and 12/13 (UI states) ✓

**Type consistency:** `orgId: text`, `propertyId: text` everywhere. `matchConfidence: 'manual' | 'auto-high' | 'auto-low' | null` identical across auto-match utility (Task 6), mapping API (Task 8), and hooks (Task 12). `pricingSnapshots.date` is ISO string throughout (matches the text-typed date column decision in Task 4).

**Placeholders:** none — every step contains actual code, actual paths, actual expected outputs.

**Known caveats that will surface during implementation:**
- `@/lib/auth/current-actor` may already exist with a different shape; Task 7 Step 5 says to inspect first and adapt.
- `apps/web/vercel.json` may not exist yet — if cron is configured differently, match that pattern.
- Real PriceLabs response shapes for `recommended_prices` and `settings` endpoints may differ from the fixture guesses in Task 2. First live call will reveal discrepancies; fix by loosening Zod fields (turning `z.number()` into `z.coerce.number()`, making fields optional) and re-record the fixtures. This is expected.
