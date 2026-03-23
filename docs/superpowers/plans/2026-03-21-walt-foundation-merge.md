# WALT Foundation Merge — Phase 1-3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move WALT's shared libraries (hospitable, stripe, ses, cdn, mailerlite) and bookings service into the host-ai monorepo, establishing the foundation for the multi-tenant website engine.

**Architecture:** Libraries from WALT's `libraries/` directory become `packages/` in host-ai, following existing conventions (TypeScript build to `dist/`, workspace dependencies). The bookings service moves to `services/bookings/` with its DB schema unified into `@walt/db`. All new tables use the `walt` PostgreSQL schema via `waltSchema`.

**Tech Stack:** TypeScript 5.8, pnpm 10.6 workspaces, Turbo, Drizzle ORM 0.40, Fastify 5, Stripe, AWS SES, Hospitable API

**Spec:** `docs/superpowers/specs/2026-03-21-walt-monorepo-merge-design.md`

**Scope:** Phases 1-3 only (move packages, unify schema, build bookings service). The sites app, content migration, competitive improvements, and deployment cutover are separate plans.

**WALT repo location:** `/Users/wesleydekkers/Documents/GitHub/WALT`

---

## File Structure

### New directories and files to create

```
packages/hospitable/              ← from WALT libraries/hospitable-api
  package.json
  tsconfig.json
  src/                            ← copy all source + generated code
    index.ts, client.ts, http.ts, error.ts
    resources/                    ← properties, reservations, inquiries, reviews, user, payouts, transactions
    generated/types/, generated/schemas/

packages/stripe/                  ← from WALT libraries/stripe
  package.json
  tsconfig.json
  src/index.ts                    ← copy from WALT

packages/ses/                     ← from WALT libraries/ses
  package.json
  tsconfig.json
  src/index.ts                    ← copy from WALT

packages/cdn/                     ← from WALT libraries/cdn
  package.json
  tsconfig.json
  src/                            ← index.ts, utils.ts, CdnImage.tsx

packages/mailerlite/              ← from WALT libraries/mailerlite
  package.json
  tsconfig.json
  src/index.ts                    ← copy from WALT

services/bookings/                ← from WALT apps/service-bookings
  package.json
  tsconfig.json
  src/
    index.ts, server.ts
    routes/bookings.ts, routes/webhooks.ts
    services/site-config.ts, services/holds.ts, services/hospitable.ts
```

### Files to modify

```
packages/db/src/schema.ts         ← add siteConfigs, inventoryHolds, bookings tables
packages/contracts/src/index.ts   ← export new bookings contracts
packages/contracts/src/bookings.ts ← new file with booking Zod schemas
infra/docker/Dockerfile.fastify   ← add bookings service + new packages to COPY
infra/docker-compose.prod.yml     ← add bookings container
.github/workflows/deploy.yml      ← add STRIPE secrets to deploy job
```

---

## Parallelization Notes

Tasks 1-7 are independent and can be executed in parallel by subagents. Task 8 depends on Tasks 2, 6, and 7. Tasks 9-10 depend on Task 8.

---

## Task 1: Create packages/hospitable

**Files:**
- Create: `packages/hospitable/package.json`
- Create: `packages/hospitable/tsconfig.json`
- Create: `packages/hospitable/src/` (copy from WALT)

- [ ] **Step 1: Copy source files from WALT**

```bash
mkdir -p packages/hospitable
cp -r /Users/wesleydekkers/Documents/GitHub/WALT/libraries/hospitable-api/src packages/hospitable/src
```

Also copy the OpenAPI spec for future regeneration:
```bash
cp /Users/wesleydekkers/Documents/GitHub/WALT/libraries/hospitable-api/openapi.json packages/hospitable/openapi.json
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@walt/hospitable",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

Note: Zod is provided by root devDependencies. The generated schemas depend on it.

- [ ] **Step 3: Create tsconfig.json**

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

- [ ] **Step 4: Convert `.ts` import extensions to `.js`**

WALT's hospitable library uses `"moduleResolution": "Bundler"` with `"allowImportingTsExtensions": true`, meaning all relative imports use `.ts` extensions (e.g., `from './http.ts'`). host-ai uses `"moduleResolution": "NodeNext"` which requires `.js` extensions and does NOT support `.ts` extensions. Additionally, `allowImportingTsExtensions` is only valid with `noEmit: true`, which conflicts with our need to emit `dist/` output.

**This step MUST be completed before the first build attempt.**

The hospitable package has ~130+ generated files in `src/generated/` plus ~10 hand-written files. Use a scripted approach:

```bash
find packages/hospitable/src -name '*.ts' -exec sed -i '' "s/from '\(\.\.\/[^']*\)\.ts'/from '\1.js'/g; s/from '\(\.\/[^']*\)\.ts'/from '\1.js'/g" {} +
find packages/hospitable/src -name '*.ts' -exec sed -i '' 's/from "\(\.\.\/[^"]*\)\.ts"/from "\1.js"/g; s/from "\(\.\/[^"]*\)\.ts"/from "\1.js"/g' {} +
```

Verify no `.ts` extensions remain in imports:
```bash
grep -rn "from ['\"]\..*\.ts['\"]" packages/hospitable/src/
```

Expected: No matches.

- [ ] **Step 5: Build and verify**

```bash
pnpm install
pnpm turbo run build typecheck --filter=@walt/hospitable
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/hospitable
git commit -m "feat: add @walt/hospitable package (from WALT libraries/hospitable-api)"
```

---

## Task 2: Create packages/stripe

**Files:**
- Create: `packages/stripe/package.json`
- Create: `packages/stripe/tsconfig.json`
- Create: `packages/stripe/src/index.ts` (copy from WALT)

- [ ] **Step 1: Copy source files from WALT**

```bash
mkdir -p packages/stripe/src
cp /Users/wesleydekkers/Documents/GitHub/WALT/libraries/stripe/src/index.ts packages/stripe/src/index.ts
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@walt/stripe",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "stripe": "^14.0.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

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

- [ ] **Step 4: Convert `.ts` import extensions to `.js` if needed** (same scripted approach as Task 1 Step 4 — check if WALT source uses `.ts` extensions in relative imports and convert to `.js`)

- [ ] **Step 5: Build and verify**

```bash
pnpm install
pnpm turbo run build typecheck --filter=@walt/stripe
```

- [ ] **Step 6: Commit**

```bash
git add packages/stripe
git commit -m "feat: add @walt/stripe package (from WALT libraries/stripe)"
```

---

## Task 3: Create packages/ses

**Files:**
- Create: `packages/ses/package.json`
- Create: `packages/ses/tsconfig.json`
- Create: `packages/ses/src/index.ts` (copy from WALT)

- [ ] **Step 1: Copy source files from WALT**

```bash
mkdir -p packages/ses/src
cp /Users/wesleydekkers/Documents/GitHub/WALT/libraries/ses/src/index.ts packages/ses/src/index.ts
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@walt/ses",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@aws-sdk/client-ses": "^3.540.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

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

- [ ] **Step 4: Fix import extensions if needed**

- [ ] **Step 5: Build and verify**

```bash
pnpm install
pnpm turbo run build typecheck --filter=@walt/ses
```

- [ ] **Step 6: Commit**

```bash
git add packages/ses
git commit -m "feat: add @walt/ses package (from WALT libraries/ses)"
```

---

## Task 4: Create packages/cdn

**Files:**
- Create: `packages/cdn/package.json`
- Create: `packages/cdn/tsconfig.json`
- Create: `packages/cdn/src/` (copy from WALT — index.ts, utils.ts, CdnImage.tsx)

- [ ] **Step 1: Copy source files from WALT**

```bash
mkdir -p packages/cdn/src
cp /Users/wesleydekkers/Documents/GitHub/WALT/libraries/cdn/src/* packages/cdn/src/
```

- [ ] **Step 2: Create package.json**

This package has a React component (CdnImage.tsx), so React is a peer dependency.

```json
{
  "name": "@walt/cdn",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Needs `jsx: "react-jsx"` for the `.tsx` file:

```json
{
  "extends": "../config-typescript/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Fix import extensions if needed**

- [ ] **Step 5: Build and verify**

```bash
pnpm install
pnpm turbo run build typecheck --filter=@walt/cdn
```

- [ ] **Step 6: Commit**

```bash
git add packages/cdn
git commit -m "feat: add @walt/cdn package (from WALT libraries/cdn)"
```

---

## Task 5: Create packages/mailerlite

**Files:**
- Create: `packages/mailerlite/package.json`
- Create: `packages/mailerlite/tsconfig.json`
- Create: `packages/mailerlite/src/index.ts` (copy from WALT)

- [ ] **Step 1: Copy source files from WALT**

```bash
mkdir -p packages/mailerlite/src
cp /Users/wesleydekkers/Documents/GitHub/WALT/libraries/mailerlite/src/index.ts packages/mailerlite/src/index.ts
```

- [ ] **Step 2: Create package.json**

No external dependencies — uses native `fetch`.

```json
{
  "name": "@walt/mailerlite",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

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

- [ ] **Step 4: Fix import extensions if needed**

- [ ] **Step 5: Build and verify**

```bash
pnpm install
pnpm turbo run build typecheck --filter=@walt/mailerlite
```

- [ ] **Step 6: Commit**

```bash
git add packages/mailerlite
git commit -m "feat: add @walt/mailerlite package (from WALT libraries/mailerlite)"
```

---

## Task 6: Add booking contracts to @walt/contracts

**Files:**
- Create: `packages/contracts/src/bookings.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Create bookings contract file**

Create `packages/contracts/src/bookings.ts`:

```typescript
import { z } from 'zod';

// ── Enums ──

export const bookingStatusSchema = z.enum([
  'pending',
  'awaiting_approval',
  'confirmed',
  'cancelled',
  'declined',
  'payment_failed',
  'refunded',
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

// ── Payment Intent ──

export const createPaymentIntentRequestSchema = z.object({
  siteId: z.string().min(1),
  propertyId: z.string().min(1),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guestEmail: z.string().email(),
  totalAmountCents: z.number().int().positive(),
});
export type CreatePaymentIntentRequest = z.infer<typeof createPaymentIntentRequestSchema>;

export const createPaymentIntentResponseSchema = z.object({
  clientSecret: z.string(),
  paymentIntentId: z.string(),
  holdId: z.string(),
  expiresAt: z.string().datetime(),
});
export type CreatePaymentIntentResponse = z.infer<typeof createPaymentIntentResponseSchema>;

// ── Booking Request ──

export const createBookingRequestSchema = z.object({
  siteId: z.string().min(1),
  paymentIntentId: z.string().min(1),
  propertyId: z.string().min(1),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  totalAmountCents: z.number().int().positive(),
});
export type CreateBookingRequest = z.infer<typeof createBookingRequestSchema>;

export const bookingResponseSchema = z.object({
  bookingId: z.string().uuid(),
  status: bookingStatusSchema,
  hospitableBookingId: z.string().optional(),
});
export type BookingResponse = z.infer<typeof bookingResponseSchema>;

// ── Booking Detail ──

export const bookingDetailSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string(),
  hospitableBookingId: z.string().nullable(),
  propertyId: z.string(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guestName: z.string(),
  guestEmail: z.string(),
  guestPhone: z.string().nullable(),
  totalAmountCents: z.number().int(),
  paymentIntentId: z.string(),
  status: bookingStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BookingDetail = z.infer<typeof bookingDetailSchema>;
```

- [ ] **Step 2: Export from index**

Add to `packages/contracts/src/index.ts`:

```typescript
export * from './bookings.js';
```

- [ ] **Step 3: Build and verify**

```bash
pnpm turbo run build typecheck --filter=@walt/contracts
```

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/bookings.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add booking Zod schemas"
```

---

## Task 7: Add booking tables to @walt/db schema

**Files:**
- Modify: `packages/db/src/schema.ts`

**Context:** These tables are adapted from WALT's `apps/service-bookings/src/db/schema.ts`. They are created fresh in the `walt` PostgreSQL schema using `waltSchema.table(...)`. Column types and names match WALT's originals for data compatibility.

- [ ] **Step 1: Add site config and booking table definitions**

Add the following to the end of `packages/db/src/schema.ts` (before any closing content):

```typescript
// ── Booking Engine ──

export const siteConfigs = waltSchema.table(
  'site_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    siteId: varchar('site_id', { length: 80 }).notNull(),
    stripeSecretKey: text('stripe_secret_key').notNull(),
    stripeWebhookSecret: text('stripe_webhook_secret').notNull(),
    hospitableApiKey: text('hospitable_api_key').notNull(),
    serviceFeeRate: numeric('service_fee_rate', { precision: 5, scale: 4 }).default('0.05'),
    taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).default('0'),
    damageDepositAmountCents: integer('damage_deposit_amount_cents').default(0),
    holdDurationMinutes: integer('hold_duration_minutes').default(15),
    notificationEmails: text('notification_emails').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('site_configs_site_id_idx').on(t.siteId)],
);

export const inventoryHolds = waltSchema.table(
  'inventory_holds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    siteId: varchar('site_id', { length: 80 }).notNull(),
    propertyId: varchar('property_id', { length: 120 }).notNull(),
    checkIn: timestamp('check_in', { withTimezone: true }).notNull(),
    checkOut: timestamp('check_out', { withTimezone: true }).notNull(),
    paymentIntentId: varchar('payment_intent_id', { length: 120 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    released: boolean('released').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('inventory_holds_site_id_idx').on(t.siteId),
    index('inventory_holds_site_property_idx').on(t.siteId, t.propertyId),
    index('inventory_holds_expires_at_idx').on(t.expiresAt),
  ],
);

export const bookings = waltSchema.table(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    siteId: varchar('site_id', { length: 80 }).notNull(),
    hospitableBookingId: varchar('hospitable_booking_id', { length: 120 }),
    propertyId: varchar('property_id', { length: 120 }).notNull(),
    checkIn: timestamp('check_in', { withTimezone: true }).notNull(),
    checkOut: timestamp('check_out', { withTimezone: true }).notNull(),
    guestName: varchar('guest_name', { length: 160 }).notNull(),
    guestEmail: varchar('guest_email', { length: 254 }).notNull(),
    guestPhone: varchar('guest_phone', { length: 40 }),
    totalAmountCents: integer('total_amount_cents').notNull(),
    paymentIntentId: varchar('payment_intent_id', { length: 120 }).notNull(),
    status: varchar('status', { length: 40 }).default('pending').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('bookings_site_id_idx').on(t.siteId),
    uniqueIndex('bookings_payment_intent_id_idx').on(t.paymentIntentId),
    index('bookings_status_idx').on(t.status),
  ],
);
```

Check that the needed imports are already at the top of schema.ts: `uuid`, `varchar`, `text`, `numeric`, `integer`, `boolean`, `timestamp`, `index`, `uniqueIndex`. Add any missing ones to the existing import from `drizzle-orm/pg-core`.

- [ ] **Step 2: Verify schema compiles**

```bash
pnpm turbo run build typecheck --filter=@walt/db
```

- [ ] **Step 3: Generate migration**

```bash
cd packages/db && pnpm db:generate
```

Expected: Creates a new migration file like `drizzle/0023_booking_engine.sql` with `CREATE TABLE` statements for the three new tables in the `walt` schema.

- [ ] **Step 4: Review the generated migration**

Read the generated SQL file. Verify:
- Tables are created in the `walt` schema (e.g., `CREATE TABLE "walt"."site_configs"`)
- All columns, indexes, and defaults match the schema definition
- No unexpected changes to existing tables

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat(db): add booking engine tables (siteConfigs, inventoryHolds, bookings)"
```

---

## Task 8: Create services/bookings

**Dependencies:** Tasks 2 (stripe), 6 (contracts), 7 (db schema)

**Files:**
- Create: `services/bookings/package.json`
- Create: `services/bookings/tsconfig.json`
- Create: `services/bookings/src/` (adapted from WALT)

**Key adaptations from WALT's `apps/service-bookings`:**
1. Replace local DB schema imports with `@walt/db`
2. Replace local Pool/drizzle setup with `createDb()` from `@walt/db`
3. Delete local `db/` directory (schema + migrations) — now in `@walt/db`
4. Delete local `drizzle.config.ts` — migrations managed centrally
5. Update `@walt/stripe` and `@walt/ses` imports to use workspace packages
6. Ensure Fastify 5 compatibility (host-ai uses Fastify 5.2.1 via pnpm overrides)

- [ ] **Step 1: Copy source files from WALT**

```bash
mkdir -p services/bookings/src
cp /Users/wesleydekkers/Documents/GitHub/WALT/apps/service-bookings/src/index.ts services/bookings/src/
cp /Users/wesleydekkers/Documents/GitHub/WALT/apps/service-bookings/src/server.ts services/bookings/src/
cp -r /Users/wesleydekkers/Documents/GitHub/WALT/apps/service-bookings/src/routes services/bookings/src/
cp -r /Users/wesleydekkers/Documents/GitHub/WALT/apps/service-bookings/src/services services/bookings/src/
```

Do NOT copy `src/db/` (local schema/migrations — replaced by `@walt/db`).
Do NOT copy `drizzle.config.ts`.

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@walt/service-bookings",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@walt/contracts": "workspace:*",
    "@walt/db": "workspace:*",
    "@walt/ses": "workspace:*",
    "@walt/stripe": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.19.3"
  }
}
```

Note: `fastify`, `drizzle-orm`, `pg`, `zod` are provided by root devDependencies/overrides.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "../../packages/config-typescript/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create DB client module**

Create `services/bookings/src/db.ts`:

```typescript
import { createDb } from '@walt/db';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

export const db = createDb(DATABASE_URL);
```

- [ ] **Step 5: Update imports in all source files**

In every file under `services/bookings/src/` that imports from the local `db/schema` or creates its own database connection:

**Replace local schema imports:**
```typescript
// Before (WALT pattern)
import { siteConfigs, inventoryHolds, bookings } from '../db/schema.js';

// After
import { siteConfigs, inventoryHolds, bookings } from '@walt/db';
```

**Replace local DB client:**
```typescript
// Before (WALT pattern — each file creating its own Pool)
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// After
import { db } from '../db.js';
```

**Files to update** (check each one):
- `src/server.ts` — DB readiness check
- `src/routes/bookings.ts` — booking CRUD operations
- `src/routes/webhooks.ts` — webhook handlers
- `src/services/site-config.ts` — site config queries
- `src/services/holds.ts` — inventory hold queries

**Update @walt/stripe imports** (should already match since package name is the same):
```typescript
import { createStripeClient, createManualCapturePaymentIntent, ... } from '@walt/stripe';
```

**Update @walt/ses imports** (should already match):
```typescript
import { sendSesEmail } from '@walt/ses';
```

**Leave `src/services/hospitable.ts` as-is** — this file uses inline `fetch` calls to the Hospitable API, NOT the `@walt/hospitable` package. Do not change these imports. The file is self-contained and works independently. Refactoring to use `@walt/hospitable` is a future improvement.

- [ ] **Step 6: Fix import extensions**

Same as Task 1 Step 4 — ensure all relative imports use `.js` extensions for NodeNext module resolution.

- [ ] **Step 7: Handle Fastify 5 compatibility**

WALT uses Fastify 4, host-ai's pnpm overrides enforce Fastify 5. Check for breaking changes:

1. Verify `fastify()` constructor call — should work the same
2. Verify `app.listen({ port, host })` — same syntax in v5
3. Verify route definitions — same syntax in v5
4. Check if any Fastify plugins are used that need v5-compatible versions

The bookings service is a bare Fastify app with no plugins, so compatibility should be straightforward. If type errors arise, update the Fastify type generics.

- [ ] **Step 8: Build and verify**

```bash
pnpm install
pnpm turbo run build typecheck --filter=@walt/service-bookings
```

Fix any type errors. Common issues:
- Missing `.js` extensions on imports
- Drizzle API differences between 0.39 and 0.40 (check query builder usage)
- Fastify type generics

- [ ] **Step 9: Commit**

```bash
git add services/bookings
git commit -m "feat: add bookings service (from WALT apps/service-bookings)"
```

---

## Task 9: Update Docker and CI/CD configuration

**Dependencies:** Task 8

**Files:**
- Modify: `infra/docker/Dockerfile.fastify`
- Modify: `infra/docker-compose.prod.yml`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Update Dockerfile.fastify**

The Dockerfile has 4 stages. The deps and build stages already use `COPY packages/ ./packages/` and `COPY services/ ./services/` which will automatically pick up new directories. Only the **runner stage** needs explicit updates because it selectively copies built output.

Reference: `infra/docker/Dockerfile.fastify:39-84`

**In the build stage (line 40)** — add `--filter=@walt/service-bookings...` to the turbo build command:

```dockerfile
RUN pnpm turbo run build --filter=@walt/gateway... --filter=@walt/service-identity... --filter=@walt/service-messaging... --filter=@walt/service-ops... --filter=@walt/service-notifications... --filter=@walt/service-tasks... --filter=@walt/service-bookings...
```

**In the runner stage** — add COPY lines for new packages (dist + package.json, matching existing pattern at lines 60-84):

After the existing `COPY --from=build /app/packages/db/package.json` line (~line 63), add:
```dockerfile
COPY --from=build /app/packages/hospitable/dist ./packages/hospitable/dist
COPY --from=build /app/packages/hospitable/package.json ./packages/hospitable/
COPY --from=build /app/packages/stripe/dist ./packages/stripe/dist
COPY --from=build /app/packages/stripe/package.json ./packages/stripe/
COPY --from=build /app/packages/ses/dist ./packages/ses/dist
COPY --from=build /app/packages/ses/package.json ./packages/ses/
COPY --from=build /app/packages/cdn/dist ./packages/cdn/dist
COPY --from=build /app/packages/cdn/package.json ./packages/cdn/
COPY --from=build /app/packages/mailerlite/dist ./packages/mailerlite/dist
COPY --from=build /app/packages/mailerlite/package.json ./packages/mailerlite/
```

Update the symlink `RUN` command (~line 66-68) to include new packages:
```dockerfile
RUN mkdir -p node_modules/@walt && \
    ln -sfn /app/packages/contracts node_modules/@walt/contracts && \
    ln -sfn /app/packages/db node_modules/@walt/db && \
    ln -sfn /app/packages/hospitable node_modules/@walt/hospitable && \
    ln -sfn /app/packages/stripe node_modules/@walt/stripe && \
    ln -sfn /app/packages/ses node_modules/@walt/ses && \
    ln -sfn /app/packages/cdn node_modules/@walt/cdn && \
    ln -sfn /app/packages/mailerlite node_modules/@walt/mailerlite
```

After the existing service COPY lines (~line 84), add:
```dockerfile
COPY --from=build /app/services/bookings/dist ./services/bookings/dist
COPY --from=build /app/services/bookings/package.json ./services/bookings/
```

- [ ] **Step 2: Update docker-compose.prod.yml**

Add the bookings service using the existing YAML anchor pattern (`<<: *fastify`). Insert before the `networks:` section at the end of the services block:

```yaml
  bookings:
    <<: *fastify
    depends_on:
      migrate:
        condition: service_completed_successfully
    environment:
      - PORT=4106
    command: ['services/bookings/dist/index.js']
    deploy:
      resources:
        limits:
          memory: 128M
```

This matches the exact pattern used by identity, messaging, ops, notifications, and tasks services (see `infra/docker-compose.prod.yml:84-147` for reference).

Also add `BOOKINGS_SERVICE_URL=http://bookings:4106` to the gateway environment if the gateway needs to proxy to bookings.

- [ ] **Step 3: Update deploy.yml**

Add new secrets to the deploy job. This requires changes in **three locations** within `.github/workflows/deploy.yml`:

1. **Secrets fetch section** (~line 133) — add secret retrieval matching existing pattern:
```yaml
STRIPE_SECRET_KEY=$(aws secretsmanager get-secret-value --secret-id hostpilot/prod/stripe-secret-key --query SecretString --output text)
STRIPE_WEBHOOK_SECRET=$(aws secretsmanager get-secret-value --secret-id hostpilot/prod/stripe-webhook-secret --query SecretString --output text)
```
Note: Check existing secrets pattern (e.g., `hostpilot/prod/database-url` uses simple string values, not JSON). Create corresponding secrets in AWS Secrets Manager before first deploy.

2. **SSH envs list** (~line 176) — add new env var names:
```yaml
envs: DATABASE_URL,CLERK_...,STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET,...
```

3. **`.env.production` heredoc** (~line 188) — add the env vars:
```
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
```

- [ ] **Step 4: Commit**

```bash
git add infra/docker/Dockerfile.fastify infra/docker-compose.prod.yml .github/workflows/deploy.yml
git commit -m "feat(infra): add bookings service to Docker and CI/CD pipeline"
```

---

## Task 10: Verify full monorepo build

**Dependencies:** All previous tasks

- [ ] **Step 1: Run full monorepo typecheck and lint**

```bash
pnpm turbo run typecheck lint
```

Expected: All packages and services pass with no errors.

- [ ] **Step 2: Run full build**

```bash
pnpm turbo run typecheck lint build --filter=@walt/web
```

This runs the CLAUDE.md-specified pre-PR check. Expected: All pass.

- [ ] **Step 3: Run full monorepo build**

```bash
pnpm turbo run build
```

Expected: All packages, apps, and services build successfully.

- [ ] **Step 4: Verify the bookings service starts locally**

```bash
PORT=4106 DATABASE_URL=postgres://walt:walt@localhost:5432/walt pnpm --filter=@walt/service-bookings dev
```

Expected: Fastify server starts on port 4106. Hit `http://localhost:4106/health` and verify `{"status":"ok"}` response. Ctrl+C to stop.

Note: WALT's default port is 4002 but we use 4106 to follow host-ai's port sequence (4101-4105 for existing services).

- [ ] **Step 5: Commit any remaining fixes**

If Steps 1-4 required fixes, commit them:

```bash
git add -A
git commit -m "fix: resolve build issues from WALT foundation merge"
```
