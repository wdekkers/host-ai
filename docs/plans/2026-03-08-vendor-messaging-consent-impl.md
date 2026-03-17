# Vendor Messaging Consent System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready SMS opt-in/opt-out consent system for vendor communications with Twilio integration, audit trail, and admin UI.

**Architecture:** Extend `services/messaging` (Fastify) with Drizzle DB + Twilio. Public `/sms/*` pages and `/api/twilio/*` + `/api/sms/*` routes live in `apps/web`. The gateway gets vendor admin proxy routes. All data models are Drizzle tables in the `walt` Postgres schema.

**Tech Stack:** Drizzle ORM (`@walt/db`), Twilio Node SDK, Zod (via `@walt/contracts`), Node `node:test` runner, Next.js App Router, Clerk auth, Fastify, `libphonenumber-js` for E.164 normalization.

**Design doc:** `docs/plans/2026-03-08-vendor-messaging-consent-design.md`

---

### Task 1: Install dependencies

**Files:**
- Modify: `services/messaging/package.json`
- Modify: `apps/web/package.json`

**Step 1: Add deps to messaging service**

Edit `services/messaging/package.json` — add to `"dependencies"`:
```json
"@walt/db": "workspace:*",
"libphonenumber-js": "^1.11.12",
"twilio": "^5.5.1",
"zod": "^3.24.1"
```

**Step 2: Add twilio to web app**

Edit `apps/web/package.json` — add to `"dependencies"`:
```json
"twilio": "^5.5.1"
```

**Step 3: Install**

```bash
pnpm install
```

Expected: clean install, no errors.

**Step 4: Commit**

```bash
git add services/messaging/package.json apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add twilio, drizzle, libphonenumber-js deps to messaging and web"
```

---

### Task 2: Extend Drizzle schema

**Files:**
- Modify: `packages/db/src/schema.ts`

**Step 1: Read the current schema**

Read `packages/db/src/schema.ts` in full to understand existing imports and table structure before editing.

**Step 2: Add enums and tables**

Append to the bottom of `packages/db/src/schema.ts`:

```typescript
// --- Vendor Messaging Consent ---

export const vendorStatusEnum = waltSchema.enum('vendor_status', [
  'invited',
  'active',
  'opted_out',
  'blocked',
]);

export const consentStatusEnum = waltSchema.enum('consent_status', [
  'opted_in',
  'opted_out',
  'pending',
]);

export const consentMethodEnum = waltSchema.enum('consent_method', [
  'web_form',
  'inbound_sms',
  'admin_import',
]);

export const messageDirectionEnum = waltSchema.enum('message_direction', [
  'outbound',
  'inbound',
]);

export const messageTypeEnum = waltSchema.enum('message_type', [
  'operational',
  'consent_confirmation',
  'help',
  'stop_confirmation',
]);

export const actorTypeEnum = waltSchema.enum('actor_type', [
  'system',
  'admin',
  'vendor',
]);

export const vendors = waltSchema.table('vendors', {
  id: uuid('id').primaryKey(),
  companyName: text('company_name').notNull(),
  contactName: text('contact_name').notNull(),
  phoneE164: text('phone_e164').notNull().unique(),
  email: text('email'),
  status: vendorStatusEnum('status').notNull().default('invited'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const smsConsents = waltSchema.table('sms_consents', {
  id: uuid('id').primaryKey(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  consentStatus: consentStatusEnum('consent_status').notNull(),
  consentMethod: consentMethodEnum('consent_method').notNull(),
  consentTextVersion: text('consent_text_version').notNull(),
  consentTextSnapshot: text('consent_text_snapshot').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceDomain: text('source_domain').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  checkboxChecked: boolean('checkbox_checked').notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const smsMessageLogs = waltSchema.table('sms_message_logs', {
  id: uuid('id').primaryKey(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  direction: messageDirectionEnum('direction').notNull(),
  twilioMessageSid: text('twilio_message_sid'),
  fromNumber: text('from_number').notNull(),
  toNumber: text('to_number').notNull(),
  body: text('body').notNull(),
  messageType: messageTypeEnum('message_type').notNull(),
  deliveryStatus: text('delivery_status'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const auditEvents = waltSchema.table('audit_events', {
  id: uuid('id').primaryKey(),
  // Not a FK so orphaned events survive vendor deletion
  vendorId: uuid('vendor_id'),
  actorType: actorTypeEnum('actor_type').notNull(),
  actorId: text('actor_id'),
  eventType: text('event_type').notNull(),
  metadata: jsonb('metadata').notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});
```

Note: `boolean` must be imported from `drizzle-orm/pg-core` — check existing imports and add it if missing.

**Step 3: Typecheck**

```bash
pnpm --filter @walt/db typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add vendor, sms_consent, sms_message_log, audit_event tables"
```

---

### Task 3: Generate and apply Drizzle migration

**Files:**
- Create: `packages/db/drizzle/0004_vendor_messaging_consent.sql` (auto-generated)

**Step 1: Generate migration**

```bash
pnpm --filter @walt/db db:generate
```

Expected: a new SQL file created in `packages/db/drizzle/`.

**Step 2: Review the generated SQL**

Read the new migration file to confirm it creates the 6 new enums and 4 new tables. Verify it does NOT drop or alter existing tables.

**Step 3: Apply migration**

```bash
pnpm --filter @walt/db db:migrate
```

Expected: "migrations applied" or similar success message. No errors.

**Step 4: Commit**

```bash
git add packages/db/drizzle/
git commit -m "feat(db): apply vendor messaging consent migration"
```

---

### Task 4: Consent text constants

**Files:**
- Create: `services/messaging/src/consent-text.ts`

**Step 1: Create the module**

```typescript
// services/messaging/src/consent-text.ts

/** Increment the version string whenever the consent text changes. */
export const CONSENT_TEXT_VERSION = 'v1';

/**
 * Exact text displayed above the opt-in checkbox on the web form.
 * This snapshot is stored in sms_consents.consent_text_snapshot on every opt-in.
 * NEVER change this without incrementing CONSENT_TEXT_VERSION.
 */
export const CONSENT_TEXT_V1 =
  'I agree to receive work-related text messages from WALT Services about ' +
  'scheduling, cleaning, maintenance, property access, and urgent operational ' +
  'issues. Message frequency varies. Reply STOP to opt out or HELP for help. ' +
  'Message and data rates may apply.';

/** SMS sent to vendor after successful opt-in. */
export const CONFIRMATION_SMS =
  "WALT Services: You're subscribed for work-related vendor texts about " +
  'scheduling and property operations. Msg frequency varies. Reply STOP to ' +
  'opt out, HELP for help.';

/** SMS sent to vendor after opt-out. */
export const OPT_OUT_SMS =
  "You've been unsubscribed from WALT Services vendor texts. Reply START to resubscribe.";

/** TwiML HELP reply text. */
export const HELP_SMS =
  'WALT Services: For scheduling, maintenance, and property operations support. ' +
  'Msg frequency varies. Reply STOP to unsubscribe. ' +
  'Contact support@waltservices.com for help.';

/** Keywords that trigger opt-out per TCPA / Twilio advanced opt-out rules. */
export const STOP_KEYWORDS = new Set([
  'STOP',
  'UNSUBSCRIBE',
  'CANCEL',
  'END',
  'QUIT',
  'STOPALL',
]);

/** Keywords that trigger opt-in via inbound SMS. */
export const START_KEYWORDS = new Set(['START', 'UNSTOP']);
```

**Step 2: Typecheck**

```bash
pnpm --filter @walt/service-messaging typecheck
```

Expected: no errors.

**Step 3: Commit**

```bash
git add services/messaging/src/consent-text.ts
git commit -m "feat(messaging): add consent text constants module"
```

---

### Task 5: Phone normalization utility + test

**Files:**
- Create: `services/messaging/src/lib/phone.ts`
- Create: `services/messaging/src/lib/phone.test.ts`

**Step 1: Write the failing tests**

```typescript
// services/messaging/src/lib/phone.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { toE164, isValidE164 } from './phone.js';

void test('toE164: formats US 10-digit number', () => {
  assert.equal(toE164('5551234567'), '+15551234567');
});

void test('toE164: strips dashes and parens', () => {
  assert.equal(toE164('(555) 123-4567'), '+15551234567');
});

void test('toE164: already E.164 passthrough', () => {
  assert.equal(toE164('+15551234567'), '+15551234567');
});

void test('toE164: returns null for invalid input', () => {
  assert.equal(toE164('notaphone'), null);
});

void test('isValidE164: valid number', () => {
  assert.equal(isValidE164('+15551234567'), true);
});

void test('isValidE164: invalid number', () => {
  assert.equal(isValidE164('5551234567'), false);
});
```

**Step 2: Update test script in messaging package.json**

Edit `services/messaging/package.json` — replace the test script:
```json
"test": "node --import tsx/esm --test 'src/**/*.test.ts'"
```

Also add `tsx` to devDependencies (check if it's in the workspace root first):
```bash
pnpm --filter @walt/service-messaging add -D tsx
```

**Step 3: Run tests to verify they fail**

```bash
pnpm --filter @walt/service-messaging test
```

Expected: FAIL — `phone.js` not found.

**Step 4: Implement the module**

```typescript
// services/messaging/src/lib/phone.ts
import { parsePhoneNumber } from 'libphonenumber-js';

/**
 * Normalize an arbitrary phone string to E.164 format (+1XXXXXXXXXX).
 * Returns null if the input cannot be parsed as a valid US number.
 * Assumes US (+1) as the default country when no country code is present.
 */
export function toE164(raw: string): string | null {
  try {
    const parsed = parsePhoneNumber(raw, 'US');
    if (!parsed.isValid()) return null;
    return parsed.format('E.164');
  } catch {
    return null;
  }
}

/** Returns true if the string is already a valid E.164 number. */
export function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value) && toE164(value) === value;
}
```

**Step 5: Run tests to verify they pass**

```bash
pnpm --filter @walt/service-messaging test
```

Expected: all 6 tests PASS.

**Step 6: Commit**

```bash
git add services/messaging/src/lib/phone.ts services/messaging/src/lib/phone.test.ts services/messaging/package.json
git commit -m "feat(messaging): add phone E.164 normalization utility"
```

---

### Task 6: Messaging service DB client + updated app factory

**Files:**
- Create: `services/messaging/src/db.ts`
- Modify: `services/messaging/src/index.ts`

**Step 1: Create DB client module**

```typescript
// services/messaging/src/db.ts
import { createDb } from '@walt/db';

/** Lazily-created singleton DB client for the messaging service. */
let _db: ReturnType<typeof createDb> | null = null;

export function getDb(): ReturnType<typeof createDb> {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    _db = createDb(url);
  }
  return _db;
}
```

**Step 2: Update buildMessagingApp to accept injected deps**

Read `services/messaging/src/index.ts` fully, then replace the function signature to accept optional deps for testability:

```typescript
// Add this type near the top of index.ts, after imports:
import { getDb } from './db.js';

type MessagingAppDeps = {
  db?: ReturnType<typeof import('@walt/db').createDb>;
};

export function buildMessagingApp(deps: MessagingAppDeps = {}) {
  const db = deps.db ?? getDb();
  const app = Fastify({ logger: true });
  // ... existing routes remain, new routes will use db
}
```

Keep the existing `/contacts` and `/messages` in-memory mock routes for now — they'll be replaced in a later task when the vendor contact concept is wired up.

**Step 3: Typecheck**

```bash
pnpm --filter @walt/service-messaging typecheck
```

Expected: no errors.

**Step 4: Run existing tests to verify nothing broke**

```bash
pnpm --filter @walt/service-messaging test
```

Expected: existing 2 tests + 6 phone tests all PASS.

**Step 5: Commit**

```bash
git add services/messaging/src/db.ts services/messaging/src/index.ts
git commit -m "feat(messaging): add DB client and DI support to app factory"
```

---

### Task 7: SMS send guard utility + test

**Files:**
- Create: `services/messaging/src/lib/sms-guard.ts`
- Create: `services/messaging/src/lib/sms-guard.test.ts`

**Step 1: Write failing tests**

```typescript
// services/messaging/src/lib/sms-guard.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { canSendToVendor } from './sms-guard.js';
import type { SmsGuardResult } from './sms-guard.js';

// Minimal mock DB shape — only what canSendToVendor queries
function makeMockDb(vendor: unknown | null, latestConsent: unknown | null) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(vendor ? [vendor] : []),
        }),
        orderBy: () => ({
          limit: () => Promise.resolve(latestConsent ? [latestConsent] : []),
        }),
      }),
    }),
  } as never;
}

void test('canSendToVendor: blocks when vendor not found', async () => {
  const db = makeMockDb(null, null);
  const result: SmsGuardResult = await canSendToVendor(db, 'unknown-id');
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'vendor_not_found');
});

void test('canSendToVendor: blocks when vendor opted_out', async () => {
  const db = makeMockDb({ id: 'v1', status: 'opted_out' }, { consentStatus: 'opted_in' });
  const result: SmsGuardResult = await canSendToVendor(db, 'v1');
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'vendor_opted_out');
});

void test('canSendToVendor: blocks when no consent record', async () => {
  const db = makeMockDb({ id: 'v1', status: 'active' }, null);
  const result: SmsGuardResult = await canSendToVendor(db, 'v1');
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'no_consent');
});

void test('canSendToVendor: allows when active and opted_in', async () => {
  const db = makeMockDb({ id: 'v1', status: 'active' }, { consentStatus: 'opted_in' });
  const result: SmsGuardResult = await canSendToVendor(db, 'v1');
  assert.equal(result.allowed, true);
});
```

**Step 2: Run to verify they fail**

```bash
pnpm --filter @walt/service-messaging test
```

Expected: FAIL — `sms-guard.js` not found.

**Step 3: Implement the guard**

```typescript
// services/messaging/src/lib/sms-guard.ts
import { desc, eq } from 'drizzle-orm';
import { vendors, smsConsents } from '@walt/db';

export type SmsGuardResult =
  | { allowed: true }
  | { allowed: false; reason: 'vendor_not_found' | 'vendor_opted_out' | 'vendor_blocked' | 'no_consent' | 'consent_not_opted_in' };

/**
 * Check whether we are allowed to send an outbound SMS to a vendor.
 * Must be called before every outbound send.
 */
export async function canSendToVendor(
  db: Parameters<typeof vendors['$inferSelect']>[0] extends never ? never : ReturnType<typeof import('../db.js').getDb>,
  vendorId: string,
): Promise<SmsGuardResult> {
  const [vendor] = await db
    .select({ id: vendors.id, status: vendors.status })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) return { allowed: false, reason: 'vendor_not_found' };
  if (vendor.status === 'opted_out') return { allowed: false, reason: 'vendor_opted_out' };
  if (vendor.status === 'blocked') return { allowed: false, reason: 'vendor_blocked' };

  const [latestConsent] = await db
    .select({ consentStatus: smsConsents.consentStatus })
    .from(smsConsents)
    .where(eq(smsConsents.vendorId, vendorId))
    .orderBy(desc(smsConsents.createdAt))
    .limit(1);

  if (!latestConsent) return { allowed: false, reason: 'no_consent' };
  if (latestConsent.consentStatus !== 'opted_in') return { allowed: false, reason: 'consent_not_opted_in' };

  return { allowed: true };
}
```

Note: the mock DB in the test is simplified. In production this runs against real Drizzle/Postgres. The type annotation is simplified for the plan — adjust as needed when TypeScript complains.

**Step 4: Run tests**

```bash
pnpm --filter @walt/service-messaging test
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add services/messaging/src/lib/sms-guard.ts services/messaging/src/lib/sms-guard.test.ts
git commit -m "feat(messaging): add SMS send guard with consent check"
```

---

### Task 8: Twilio utility module

**Files:**
- Create: `services/messaging/src/twilio.ts`

**Step 1: Create the module**

```typescript
// services/messaging/src/twilio.ts
import twilio from 'twilio';

let _client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!_client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
    _client = twilio(sid, token);
  }
  return _client;
}

export type SendSmsOptions = {
  to: string;
  body: string;
  from?: string;
};

/**
 * Send an outbound SMS via Twilio.
 * Uses TWILIO_MESSAGING_SERVICE_SID if set, falls back to TWILIO_PHONE_NUMBER.
 */
export async function sendSms(opts: SendSmsOptions): Promise<string | null> {
  const client = getClient();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = opts.from ?? process.env.TWILIO_PHONE_NUMBER;

  const message = await client.messages.create({
    to: opts.to,
    body: opts.body,
    ...(messagingServiceSid
      ? { messagingServiceSid }
      : { from: fromNumber }),
  });

  return message.sid ?? null;
}

/**
 * Validate a Twilio webhook request signature.
 * Returns true if the request is genuinely from Twilio.
 *
 * @param signature  Value of X-Twilio-Signature header
 * @param url        The full public URL Twilio called (must match exactly)
 * @param params     For form-encoded webhooks, the POST body as key-value pairs
 */
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) throw new Error('TWILIO_AUTH_TOKEN is not set');
  return twilio.validateRequest(authToken, signature, url, params);
}
```

**Step 2: Typecheck**

```bash
pnpm --filter @walt/service-messaging typecheck
```

Expected: no errors.

**Step 3: Commit**

```bash
git add services/messaging/src/twilio.ts
git commit -m "feat(messaging): add Twilio client utility module"
```

---

### Task 9: Consent opt-in route

**Files:**
- Modify: `services/messaging/src/index.ts`
- Create: `services/messaging/src/routes/consent.ts`
- Create: `services/messaging/src/routes/consent.test.ts`

**Step 1: Write failing test for opt-in**

```typescript
// services/messaging/src/routes/consent.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMessagingApp } from '../index.js';

// Minimal mock DB that satisfies the opt-in route queries
function makeMockDb() {
  const stored: Record<string, unknown[]> = { vendors: [], sms_consents: [], sms_message_logs: [], audit_events: [] };
  return {
    _stored: stored,
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    insert: (table: { name?: string }) => ({
      values: (row: unknown) => {
        stored[table?.name ?? 'unknown'] = [...(stored[table?.name ?? 'unknown'] ?? []), row];
        return { onConflictDoUpdate: () => Promise.resolve(), returning: () => Promise.resolve([{ id: 'new-vendor-id' }]) };
      },
    }),
  } as never;
}

void test('POST /consent/opt-in: returns 400 when phone invalid', async () => {
  const app = buildMessagingApp({ db: makeMockDb(), skipTwilio: true });
  const res = await app.inject({
    method: 'POST',
    url: '/consent/opt-in',
    payload: {
      contactName: 'Jane Doe',
      phone: 'notaphone',
      checkboxChecked: true,
      sourceUrl: 'http://localhost:3000/sms/opt-in',
    },
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});

void test('POST /consent/opt-in: returns 400 when checkbox not checked', async () => {
  const app = buildMessagingApp({ db: makeMockDb(), skipTwilio: true });
  const res = await app.inject({
    method: 'POST',
    url: '/consent/opt-in',
    payload: {
      contactName: 'Jane Doe',
      phone: '+15551234567',
      checkboxChecked: false,
      sourceUrl: 'http://localhost:3000/sms/opt-in',
    },
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});

void test('POST /consent/opt-in: returns 200 with valid input', async () => {
  const app = buildMessagingApp({ db: makeMockDb(), skipTwilio: true });
  const res = await app.inject({
    method: 'POST',
    url: '/consent/opt-in',
    payload: {
      contactName: 'Jane Doe',
      companyName: 'Acme Cleaners',
      phone: '+15551234567',
      checkboxChecked: true,
      sourceUrl: 'http://localhost:3000/sms/opt-in',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { vendorId: string };
  assert.ok(body.vendorId);
  await app.close();
});
```

**Step 2: Run to verify failure**

```bash
pnpm --filter @walt/service-messaging test
```

Expected: FAIL — route does not exist yet.

**Step 3: Create consent routes module**

```typescript
// services/messaging/src/routes/consent.ts
import { desc, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { vendors, smsConsents, smsMessageLogs, auditEvents } from '@walt/db';
import { toE164 } from '../lib/phone.js';
import { sendSms } from '../twilio.js';
import {
  CONSENT_TEXT_VERSION,
  CONSENT_TEXT_V1,
  CONFIRMATION_SMS,
  OPT_OUT_SMS,
} from '../consent-text.js';

import type { FastifyInstance } from 'fastify';
import type { getDb } from '../db.js';

const optInBodySchema = z.object({
  contactName: z.string().min(1),
  companyName: z.string().optional(),
  phone: z.string().min(1),
  checkboxChecked: z.boolean(),
  sourceUrl: z.string().url(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

const optOutBodySchema = z.object({
  phone: z.string().min(1),
  sendConfirmation: z.boolean().optional().default(true),
});

export function registerConsentRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof getDb>,
  skipTwilio = false,
) {
  // POST /consent/opt-in
  app.post('/consent/opt-in', async (request, reply) => {
    const parsed = optInBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { contactName, companyName, phone, checkboxChecked, sourceUrl, ipAddress, userAgent } =
      parsed.data;

    if (!checkboxChecked) {
      return reply.status(400).send({ error: 'Consent checkbox must be checked' });
    }

    const phoneE164 = toE164(phone);
    if (!phoneE164) {
      return reply.status(400).send({ error: 'Invalid phone number — must be a valid US number' });
    }

    const now = new Date();
    const sourceUrl_ = sourceUrl;
    const sourceDomain = new URL(sourceUrl_).hostname;

    // Upsert vendor
    const vendorId = uuidv4();
    const [vendor] = await db
      .insert(vendors)
      .values({
        id: vendorId,
        contactName,
        companyName: companyName ?? '',
        phoneE164,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: vendors.phoneE164,
        set: {
          contactName,
          companyName: companyName ?? '',
          status: 'active',
          updatedAt: now,
        },
      })
      .returning({ id: vendors.id });

    const resolvedVendorId = vendor!.id;

    // Create consent record
    const consentId = uuidv4();
    await db.insert(smsConsents).values({
      id: consentId,
      vendorId: resolvedVendorId,
      consentStatus: 'opted_in',
      consentMethod: 'web_form',
      consentTextVersion: CONSENT_TEXT_VERSION,
      consentTextSnapshot: CONSENT_TEXT_V1,
      sourceUrl: sourceUrl_,
      sourceDomain,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      checkboxChecked: true,
      confirmedAt: now,
      revokedAt: null,
      createdAt: now,
    });

    // Audit event
    await db.insert(auditEvents).values({
      id: uuidv4(),
      vendorId: resolvedVendorId,
      actorType: 'vendor',
      actorId: phoneE164,
      eventType: 'vendor.opted_in',
      metadata: { consentId, consentMethod: 'web_form', sourceUrl: sourceUrl_ },
      createdAt: now,
    });

    // Send confirmation SMS (skip in test mode)
    if (!skipTwilio) {
      try {
        const sid = await sendSms({ to: phoneE164, body: CONFIRMATION_SMS });
        if (sid) {
          await db.insert(smsMessageLogs).values({
            id: uuidv4(),
            vendorId: resolvedVendorId,
            direction: 'outbound',
            twilioMessageSid: sid,
            fromNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
            toNumber: phoneE164,
            body: CONFIRMATION_SMS,
            messageType: 'consent_confirmation',
            deliveryStatus: null,
            createdAt: now,
          });
        }
      } catch (err) {
        // Log but don't fail — consent is already recorded
        app.log.error({ err }, 'Failed to send opt-in confirmation SMS');
      }
    }

    return reply.send({ vendorId: resolvedVendorId, phoneE164 });
  });

  // POST /consent/opt-out
  app.post('/consent/opt-out', async (request, reply) => {
    const parsed = optOutBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { phone, sendConfirmation } = parsed.data;
    const phoneE164 = toE164(phone);
    if (!phoneE164) {
      return reply.status(400).send({ error: 'Invalid phone number' });
    }

    const [vendor] = await db
      .select({ id: vendors.id, status: vendors.status })
      .from(vendors)
      .where(eq(vendors.phoneE164, phoneE164))
      .limit(1);

    if (!vendor) {
      return reply.status(404).send({ error: 'No vendor found with that phone number' });
    }

    const now = new Date();

    // Revoke latest consent
    const [latestConsent] = await db
      .select({ id: smsConsents.id })
      .from(smsConsents)
      .where(eq(smsConsents.vendorId, vendor.id))
      .orderBy(desc(smsConsents.createdAt))
      .limit(1);

    if (latestConsent) {
      await db
        .update(smsConsents)
        .set({ consentStatus: 'opted_out', revokedAt: now })
        .where(eq(smsConsents.id, latestConsent.id));
    }

    // Update vendor status
    await db
      .update(vendors)
      .set({ status: 'opted_out', updatedAt: now })
      .where(eq(vendors.id, vendor.id));

    // Audit event
    await db.insert(auditEvents).values({
      id: uuidv4(),
      vendorId: vendor.id,
      actorType: 'vendor',
      actorId: phoneE164,
      eventType: 'vendor.opted_out',
      metadata: { method: 'web_form' },
      createdAt: now,
    });

    // Optional confirmation SMS
    if (sendConfirmation && !skipTwilio) {
      try {
        const sid = await sendSms({ to: phoneE164, body: OPT_OUT_SMS });
        if (sid) {
          await db.insert(smsMessageLogs).values({
            id: uuidv4(),
            vendorId: vendor.id,
            direction: 'outbound',
            twilioMessageSid: sid,
            fromNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
            toNumber: phoneE164,
            body: OPT_OUT_SMS,
            messageType: 'stop_confirmation',
            deliveryStatus: null,
            createdAt: now,
          });
        }
      } catch (err) {
        app.log.error({ err }, 'Failed to send opt-out confirmation SMS');
      }
    }

    return reply.send({ success: true, phoneE164 });
  });
}
```

Note: you'll need `uuid` package. Add `"uuid": "^11.0.0"` to `services/messaging/package.json` dependencies and run `pnpm install`.

**Step 4: Register routes in index.ts**

Update `buildMessagingApp` in `services/messaging/src/index.ts` to accept `skipTwilio` dep and register consent routes:

```typescript
// Add to deps type:
type MessagingAppDeps = {
  db?: ReturnType<typeof import('@walt/db').createDb>;
  skipTwilio?: boolean;
};

// Inside buildMessagingApp, after app is created:
import { registerConsentRoutes } from './routes/consent.js';
// ...
registerConsentRoutes(app, db, deps.skipTwilio ?? false);
```

**Step 5: Run tests**

```bash
pnpm --filter @walt/service-messaging test
```

Expected: all tests PASS including the 3 new consent route tests.

**Step 6: Commit**

```bash
git add services/messaging/src/routes/consent.ts services/messaging/src/routes/consent.test.ts services/messaging/src/index.ts
git commit -m "feat(messaging): add consent opt-in and opt-out routes"
```

---

### Task 10: Vendor admin routes

**Files:**
- Create: `services/messaging/src/routes/vendors.ts`
- Modify: `services/messaging/src/index.ts`

**Step 1: Create vendor admin routes**

```typescript
// services/messaging/src/routes/vendors.ts
import { desc, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { vendors, smsConsents, smsMessageLogs, auditEvents } from '@walt/db';

import type { FastifyInstance } from 'fastify';
import type { getDb } from '../db.js';

export function registerVendorRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof getDb>,
) {
  // GET /vendors — list all vendors with consent + last message summary
  app.get('/vendors', async (_request, reply) => {
    const rows = await db
      .select({
        id: vendors.id,
        companyName: vendors.companyName,
        contactName: vendors.contactName,
        phoneE164: vendors.phoneE164,
        email: vendors.email,
        status: vendors.status,
        createdAt: vendors.createdAt,
        updatedAt: vendors.updatedAt,
      })
      .from(vendors)
      .orderBy(desc(vendors.createdAt));

    // Enrich with latest consent and message date for each vendor
    const enriched = await Promise.all(
      rows.map(async (vendor) => {
        const [latestConsent] = await db
          .select({ consentStatus: smsConsents.consentStatus, createdAt: smsConsents.createdAt })
          .from(smsConsents)
          .where(eq(smsConsents.vendorId, vendor.id))
          .orderBy(desc(smsConsents.createdAt))
          .limit(1);

        const [latestMessage] = await db
          .select({ createdAt: smsMessageLogs.createdAt })
          .from(smsMessageLogs)
          .where(eq(smsMessageLogs.vendorId, vendor.id))
          .orderBy(desc(smsMessageLogs.createdAt))
          .limit(1);

        return {
          ...vendor,
          latestConsentStatus: latestConsent?.consentStatus ?? null,
          lastConsentAt: latestConsent?.createdAt ?? null,
          lastMessageAt: latestMessage?.createdAt ?? null,
        };
      }),
    );

    return reply.send({ items: enriched });
  });

  // GET /vendors/:id/history — full consent + audit trail
  app.get('/vendors/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, id))
      .limit(1);

    if (!vendor) return reply.status(404).send({ error: 'Vendor not found' });

    const consents = await db
      .select()
      .from(smsConsents)
      .where(eq(smsConsents.vendorId, id))
      .orderBy(desc(smsConsents.createdAt));

    const events = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.vendorId, id))
      .orderBy(desc(auditEvents.createdAt));

    return reply.send({ vendor, consents, auditEvents: events });
  });

  // PATCH /vendors/:id/disable — admin manually blocks a vendor
  app.patch('/vendors/:id/disable', async (request, reply) => {
    const { id } = request.params as { id: string };
    const now = new Date();

    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.id, id))
      .limit(1);

    if (!vendor) return reply.status(404).send({ error: 'Vendor not found' });

    await db
      .update(vendors)
      .set({ status: 'blocked', updatedAt: now })
      .where(eq(vendors.id, id));

    await db.insert(auditEvents).values({
      id: uuidv4(),
      vendorId: id,
      actorType: 'admin',
      actorId: null,
      eventType: 'vendor.blocked',
      metadata: { reason: 'manual_admin_disable' },
      createdAt: now,
    });

    return reply.send({ success: true });
  });
}
```

**Step 2: Register in index.ts**

```typescript
import { registerVendorRoutes } from './routes/vendors.js';
// inside buildMessagingApp:
registerVendorRoutes(app, db);
```

**Step 3: Typecheck**

```bash
pnpm --filter @walt/service-messaging typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add services/messaging/src/routes/vendors.ts services/messaging/src/index.ts
git commit -m "feat(messaging): add vendor list, history, and disable admin routes"
```

---

### Task 11: Twilio inbound webhook route + test

**Files:**
- Create: `services/messaging/src/routes/webhooks.ts`
- Create: `services/messaging/src/routes/webhooks.test.ts`
- Modify: `services/messaging/src/index.ts`

**Step 1: Write failing tests**

```typescript
// services/messaging/src/routes/webhooks.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMessagingApp } from '../index.js';

function makeMockDb(vendor: unknown | null = { id: 'v1', status: 'active' }) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(vendor ? [vendor] : []),
          orderBy: () => ({ limit: () => Promise.resolve([{ id: 'c1', consentStatus: 'opted_in' }]) }),
        }),
        orderBy: () => ({ limit: () => Promise.resolve([{ id: 'c1' }]) }),
      }),
    }),
    insert: () => ({ values: () => Promise.resolve() }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  } as never;
}

void test('POST /webhooks/inbound: returns TwiML for STOP keyword', async () => {
  const app = buildMessagingApp({ db: makeMockDb(), skipTwilio: true, skipSignatureValidation: true });
  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/inbound',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'From=%2B15551234567&To=%2B15559999999&Body=STOP',
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.headers['content-type']?.includes('text/xml'));
  await app.close();
});

void test('POST /webhooks/inbound: returns TwiML HELP reply for HELP keyword', async () => {
  const app = buildMessagingApp({ db: makeMockDb(), skipTwilio: true, skipSignatureValidation: true });
  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/inbound',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'From=%2B15551234567&To=%2B15559999999&Body=HELP',
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.includes('WALT Services'));
  await app.close();
});

void test('POST /webhooks/inbound: stores non-keyword messages', async () => {
  const app = buildMessagingApp({ db: makeMockDb(), skipTwilio: true, skipSignatureValidation: true });
  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/inbound',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'From=%2B15551234567&To=%2B15559999999&Body=I+will+be+there+at+10am',
  });
  assert.equal(res.statusCode, 200);
  await app.close();
});
```

**Step 2: Run to verify failure**

```bash
pnpm --filter @walt/service-messaging test
```

Expected: FAIL — webhooks route not found.

**Step 3: Create webhooks route module**

```typescript
// services/messaging/src/routes/webhooks.ts
import { desc, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { vendors, smsConsents, smsMessageLogs, auditEvents } from '@walt/db';
import { validateTwilioSignature } from '../twilio.js';
import { STOP_KEYWORDS, START_KEYWORDS, HELP_SMS, OPT_OUT_SMS, CONSENT_TEXT_VERSION, CONSENT_TEXT_V1 } from '../consent-text.js';

import type { FastifyInstance } from 'fastify';
import type { getDb } from '../db.js';

function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

function messageTag(text: string): string {
  return `<Message>${text}</Message>`;
}

export function registerWebhookRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof getDb>,
  skipSignatureValidation = false,
) {
  // Twilio sends form-encoded bodies; configure Fastify to parse them
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      const parsed = Object.fromEntries(new URLSearchParams(body as string));
      done(null, parsed);
    },
  );

  // POST /webhooks/inbound — handle inbound SMS from Twilio
  app.post('/webhooks/inbound', async (request, reply) => {
    // Validate Twilio signature unless in test mode
    if (!skipSignatureValidation) {
      const signature = request.headers['x-twilio-signature'] as string | undefined;
      const webhookUrl = process.env.TWILIO_WEBHOOK_URL ?? '';
      const params = request.body as Record<string, string>;
      if (!signature || !validateTwilioSignature(signature, webhookUrl, params)) {
        return reply.status(403).send('Forbidden');
      }
    }

    const body = request.body as Record<string, string>;
    const fromNumber = body['From'] ?? '';
    const toNumber = body['To'] ?? '';
    const rawText = (body['Body'] ?? '').trim().toUpperCase();
    const now = new Date();

    reply.header('content-type', 'text/xml');

    // Look up vendor by phone number
    const [vendor] = await db
      .select({ id: vendors.id, status: vendors.status })
      .from(vendors)
      .where(eq(vendors.phoneE164, fromNumber))
      .limit(1);

    if (STOP_KEYWORDS.has(rawText)) {
      // Mark opted_out
      if (vendor) {
        const [latestConsent] = await db
          .select({ id: smsConsents.id })
          .from(smsConsents)
          .where(eq(smsConsents.vendorId, vendor.id))
          .orderBy(desc(smsConsents.createdAt))
          .limit(1);

        if (latestConsent) {
          await db
            .update(smsConsents)
            .set({ consentStatus: 'opted_out', revokedAt: now })
            .where(eq(smsConsents.id, latestConsent.id));
        }

        await db
          .update(vendors)
          .set({ status: 'opted_out', updatedAt: now })
          .where(eq(vendors.id, vendor.id));

        await db.insert(auditEvents).values({
          id: uuidv4(),
          vendorId: vendor.id,
          actorType: 'vendor',
          actorId: fromNumber,
          eventType: 'vendor.opted_out',
          metadata: { method: 'inbound_sms', keyword: rawText },
          createdAt: now,
        });

        await db.insert(smsMessageLogs).values({
          id: uuidv4(),
          vendorId: vendor.id,
          direction: 'inbound',
          twilioMessageSid: body['MessageSid'] ?? null,
          fromNumber,
          toNumber,
          body: body['Body'] ?? '',
          messageType: 'stop_confirmation',
          deliveryStatus: null,
          createdAt: now,
        });
      }

      // Return empty TwiML — Twilio advanced opt-out handles the reply
      return reply.send(twiml(''));
    }

    if (START_KEYWORDS.has(rawText)) {
      if (vendor) {
        await db.insert(smsConsents).values({
          id: uuidv4(),
          vendorId: vendor.id,
          consentStatus: 'opted_in',
          consentMethod: 'inbound_sms',
          consentTextVersion: CONSENT_TEXT_VERSION,
          consentTextSnapshot: CONSENT_TEXT_V1,
          sourceUrl: 'sms://inbound',
          sourceDomain: 'sms',
          ipAddress: null,
          userAgent: null,
          checkboxChecked: false,
          confirmedAt: now,
          revokedAt: null,
          createdAt: now,
        });

        await db
          .update(vendors)
          .set({ status: 'active', updatedAt: now })
          .where(eq(vendors.id, vendor.id));

        await db.insert(auditEvents).values({
          id: uuidv4(),
          vendorId: vendor.id,
          actorType: 'vendor',
          actorId: fromNumber,
          eventType: 'vendor.opted_in',
          metadata: { method: 'inbound_sms', keyword: rawText },
          createdAt: now,
        });
      }

      return reply.send(twiml(''));
    }

    if (rawText === 'HELP') {
      return reply.send(twiml(messageTag(HELP_SMS)));
    }

    // General inbound message — store and surface in inbox
    if (vendor) {
      await db.insert(smsMessageLogs).values({
        id: uuidv4(),
        vendorId: vendor.id,
        direction: 'inbound',
        twilioMessageSid: body['MessageSid'] ?? null,
        fromNumber,
        toNumber,
        body: body['Body'] ?? '',
        messageType: 'operational',
        deliveryStatus: null,
        createdAt: now,
      });
    }

    return reply.send(twiml(''));
  });

  // POST /webhooks/status — update delivery status for a logged message
  app.post('/webhooks/status', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const sid = body['MessageSid'];
    const status = body['MessageStatus'];

    if (sid && status) {
      await db
        .update(smsMessageLogs)
        .set({ deliveryStatus: status })
        .where(eq(smsMessageLogs.twilioMessageSid, sid));
    }

    reply.header('content-type', 'text/xml');
    return reply.send(twiml(''));
  });
}
```

**Step 4: Register in index.ts**

```typescript
import { registerWebhookRoutes } from './routes/webhooks.js';
// Update deps type:
type MessagingAppDeps = {
  db?: ReturnType<typeof import('@walt/db').createDb>;
  skipTwilio?: boolean;
  skipSignatureValidation?: boolean;
};
// inside buildMessagingApp:
registerWebhookRoutes(app, db, deps.skipSignatureValidation ?? false);
```

**Step 5: Run tests**

```bash
pnpm --filter @walt/service-messaging test
```

Expected: all tests PASS.

**Step 6: Commit**

```bash
git add services/messaging/src/routes/webhooks.ts services/messaging/src/routes/webhooks.test.ts services/messaging/src/index.ts
git commit -m "feat(messaging): add Twilio inbound webhook and status callback routes"
```

---

### Task 12: Guarded SMS send route

**Files:**
- Create: `services/messaging/src/routes/sms.ts`
- Modify: `services/messaging/src/index.ts`

**Step 1: Create guarded send route**

```typescript
// services/messaging/src/routes/sms.ts
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { smsMessageLogs, auditEvents } from '@walt/db';
import { canSendToVendor } from '../lib/sms-guard.js';
import { sendSms } from '../twilio.js';

import type { FastifyInstance } from 'fastify';
import type { getDb } from '../db.js';

const sendBodySchema = z.object({
  vendorId: z.string().uuid(),
  toNumber: z.string().min(1),
  body: z.string().min(1).max(1600),
  messageType: z.enum(['operational', 'consent_confirmation', 'help', 'stop_confirmation']).default('operational'),
});

export function registerSmsRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof getDb>,
  skipTwilio = false,
) {
  // POST /sms/send — guarded outbound SMS
  app.post('/sms/send', async (request, reply) => {
    const parsed = sendBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { vendorId, toNumber, body, messageType } = parsed.data;
    const now = new Date();

    // Check consent before sending
    const guard = await canSendToVendor(db, vendorId);
    if (!guard.allowed) {
      // Log blocked attempt
      await db.insert(auditEvents).values({
        id: uuidv4(),
        vendorId,
        actorType: 'system',
        actorId: null,
        eventType: 'sms.blocked',
        metadata: { reason: guard.reason, toNumber },
        createdAt: now,
      });

      return reply.status(403).send({ error: 'Send blocked', reason: guard.reason });
    }

    let twilioSid: string | null = null;
    if (!skipTwilio) {
      try {
        twilioSid = await sendSms({ to: toNumber, body });
      } catch (err) {
        app.log.error({ err }, 'Twilio send failed');
        return reply.status(502).send({ error: 'Failed to send SMS' });
      }
    }

    await db.insert(smsMessageLogs).values({
      id: uuidv4(),
      vendorId,
      direction: 'outbound',
      twilioMessageSid: twilioSid,
      fromNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
      toNumber,
      body,
      messageType,
      deliveryStatus: null,
      createdAt: now,
    });

    return reply.send({ success: true, twilioSid });
  });
}
```

**Step 2: Register in index.ts**

```typescript
import { registerSmsRoutes } from './routes/sms.js';
// inside buildMessagingApp:
registerSmsRoutes(app, db, deps.skipTwilio ?? false);
```

**Step 3: Typecheck**

```bash
pnpm --filter @walt/service-messaging typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add services/messaging/src/routes/sms.ts services/messaging/src/index.ts
git commit -m "feat(messaging): add guarded SMS send route with consent check"
```

---

### Task 13: Update messaging service package.json test script + run full test suite

**Step 1: Verify test script**

Confirm `services/messaging/package.json` has the test script updated from Task 5:
```json
"test": "node --import tsx/esm --test 'src/**/*.test.ts'"
```

**Step 2: Run full suite**

```bash
pnpm --filter @walt/service-messaging test
```

Expected: all tests pass — phone normalization (6), consent routes (3), webhook routes (3), guard (4) = 16 total.

**Step 3: Commit if test script wasn't committed yet**

```bash
git add services/messaging/package.json
git commit -m "chore(messaging): wire up test runner script"
```

---

### Task 14: Gateway vendor proxy routes

**Files:**
- Modify: `apps/gateway/src/index.ts`

**Step 1: Read the gateway file**

Read `apps/gateway/src/index.ts` in full to understand the existing proxy pattern before editing.

**Step 2: Add vendor proxy routes**

Following the exact pattern of existing `/messaging/contacts` and `/messaging/messages` proxy routes, append to `apps/gateway/src/index.ts` before the `app.listen` call:

```typescript
// Vendor admin routes — proxied to messaging service
app.get('/vendors', async (_request, reply) => {
  try {
    const response = await fetch(`${messagingServiceBaseUrl}/vendors`);
    if (!response.ok) {
      return reply.status(response.status).send({ error: `Messaging service returned ${response.status}` });
    }
    return reply.send(await response.json());
  } catch (error) {
    app.log.error({ error }, 'Failed to load vendors from messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});

app.get('/vendors/:id/history', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const response = await fetch(`${messagingServiceBaseUrl}/vendors/${id}/history`);
    if (!response.ok) {
      return reply.status(response.status).send({ error: `Messaging service returned ${response.status}` });
    }
    return reply.send(await response.json());
  } catch (error) {
    app.log.error({ error }, 'Failed to load vendor history from messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});

app.patch('/vendors/:id/disable', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const response = await fetch(`${messagingServiceBaseUrl}/vendors/${id}/disable`, {
      method: 'PATCH',
    });
    if (!response.ok) {
      return reply.status(response.status).send({ error: `Messaging service returned ${response.status}` });
    }
    return reply.send(await response.json());
  } catch (error) {
    app.log.error({ error }, 'Failed to disable vendor in messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});
```

**Step 3: Typecheck**

```bash
pnpm --filter @walt/gateway typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/gateway/src/index.ts
git commit -m "feat(gateway): add vendor admin proxy routes"
```

---

### Task 15: Next.js API routes (opt-in, opt-out, Twilio passthrough)

**Files:**
- Create: `apps/web/src/app/api/sms/opt-in/route.ts`
- Create: `apps/web/src/app/api/sms/opt-out/route.ts`
- Create: `apps/web/src/app/api/twilio/inbound/route.ts`
- Create: `apps/web/src/app/api/twilio/status/route.ts`

**Step 1: Create opt-in API route**

```typescript
// apps/web/src/app/api/sms/opt-in/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  contactName: z.string().min(1, 'Contact name is required'),
  companyName: z.string().optional(),
  phone: z.string().min(1, 'Phone number is required'),
  checkboxChecked: z.boolean(),
  sourceUrl: z.string().url(),
});

const messagingServiceUrl = process.env.MESSAGING_SERVICE_URL ?? 'http://127.0.0.1:4102';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Extract request metadata for audit trail
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null;
  const userAgent = request.headers.get('user-agent') ?? null;

  try {
    const response = await fetch(`${messagingServiceUrl}/consent/opt-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...parsed.data, ipAddress, userAgent }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Messaging service unavailable' }, { status: 502 });
  }
}
```

**Step 2: Create opt-out API route**

```typescript
// apps/web/src/app/api/sms/opt-out/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  sendConfirmation: z.boolean().optional().default(true),
});

const messagingServiceUrl = process.env.MESSAGING_SERVICE_URL ?? 'http://127.0.0.1:4102';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const response = await fetch(`${messagingServiceUrl}/consent/opt-out`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Messaging service unavailable' }, { status: 502 });
  }
}
```

**Step 3: Create Twilio inbound passthrough with signature validation**

```typescript
// apps/web/src/app/api/twilio/inbound/route.ts
import twilio from 'twilio';
import { NextResponse } from 'next/server';

const messagingServiceUrl = process.env.MESSAGING_SERVICE_URL ?? 'http://127.0.0.1:4102';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  // Validate Twilio signature before proxying
  const signature = request.headers.get('x-twilio-signature') ?? '';
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/inbound`;

  const isValid = twilio.validateRequest(authToken, signature, webhookUrl, params);
  if (!isValid && process.env.NODE_ENV === 'production') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const response = await fetch(`${messagingServiceUrl}/webhooks/inbound`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        // Tell messaging service to skip re-validation since we validated here
        'x-twilio-validated': 'true',
      },
      body: rawBody,
    });

    const responseText = await response.text();
    return new NextResponse(responseText, {
      status: response.status,
      headers: { 'content-type': 'text/xml' },
    });
  } catch {
    return new NextResponse(
      '<?xml version="1.0"?><Response></Response>',
      { status: 200, headers: { 'content-type': 'text/xml' } },
    );
  }
}
```

**Step 4: Create Twilio status passthrough**

```typescript
// apps/web/src/app/api/twilio/status/route.ts
import { NextResponse } from 'next/server';

const messagingServiceUrl = process.env.MESSAGING_SERVICE_URL ?? 'http://127.0.0.1:4102';

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const response = await fetch(`${messagingServiceUrl}/webhooks/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: rawBody,
    });

    const responseText = await response.text();
    return new NextResponse(responseText, {
      status: response.status,
      headers: { 'content-type': 'text/xml' },
    });
  } catch {
    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      status: 200,
      headers: { 'content-type': 'text/xml' },
    });
  }
}
```

**Step 5: Typecheck**

```bash
pnpm --filter @walt/web typecheck
```

Expected: no errors.

**Step 6: Commit**

```bash
git add apps/web/src/app/api/sms/ apps/web/src/app/api/twilio/
git commit -m "feat(web): add SMS opt-in/opt-out and Twilio webhook API routes"
```

---

### Task 16: Public /sms/opt-in page

**Files:**
- Create: `apps/web/src/app/sms/opt-in/page.tsx`

**Step 1: Create the opt-in page**

This is a React Server Component with a client form component. Create a client component for the form:

Create `apps/web/src/app/sms/opt-in/OptInForm.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { CONSENT_TEXT_V1 } from '@/lib/consent-text';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export function OptInForm() {
  const [state, setState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('submitting');
    setErrorMessage('');

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch('/api/sms/opt-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contactName: data.get('contactName'),
          companyName: data.get('companyName') || undefined,
          phone: data.get('phone'),
          checkboxChecked: data.get('checkboxChecked') === 'on',
          sourceUrl: window.location.href,
        }),
      });

      if (response.ok) {
        setState('success');
      } else {
        const err = (await response.json()) as { error?: string };
        setErrorMessage(err.error ?? 'Something went wrong. Please try again.');
        setState('error');
      }
    } catch {
      setErrorMessage('Unable to submit. Please check your connection and try again.');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-6 text-center" role="status">
        <p className="text-green-800 font-medium text-lg">You&apos;re subscribed.</p>
        <p className="text-green-700 mt-2 text-sm">
          You&apos;ll receive a confirmation text shortly. Reply STOP at any time to opt out.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="contactName" className="block text-sm font-medium text-gray-700 mb-1">
          Contact name <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id="contactName"
          name="contactName"
          type="text"
          required
          autoComplete="name"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
      </div>

      <div>
        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
          Company name <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          autoComplete="organization"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          Mobile phone number <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="+1 (555) 000-0000"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
      </div>

      {/* Consent language */}
      <div className="rounded-md bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">
        {CONSENT_TEXT_V1}
      </div>

      <div className="flex items-start gap-3">
        <input
          id="checkboxChecked"
          name="checkboxChecked"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
        />
        <label htmlFor="checkboxChecked" className="text-sm text-gray-700">
          I agree to the above terms <span aria-hidden="true" className="text-red-500">*</span>
        </label>
      </div>

      {state === 'error' && (
        <p className="text-sm text-red-600" role="alert">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      >
        {state === 'submitting' ? 'Submitting…' : 'Subscribe to vendor texts'}
      </button>
    </form>
  );
}
```

Now create the page:

```tsx
// apps/web/src/app/sms/opt-in/page.tsx
import type { Metadata } from 'next';
import { OptInForm } from './OptInForm';

export const metadata: Metadata = {
  title: 'Subscribe to WALT Services Vendor Texts',
  robots: 'noindex',
};

export default function SmsOptInPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Vendor text message opt-in</h1>
          <p className="mt-2 text-sm text-gray-600">
            Subscribe to receive work-related text messages from WALT Services about scheduling,
            property access, and operational updates.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <OptInForm />
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center">
          Message and data rates may apply. Reply STOP to opt out. Reply HELP for help.{' '}
          <a href="/sms/privacy" className="underline hover:text-gray-600">Privacy policy</a>
          {' · '}
          <a href="/sms/terms" className="underline hover:text-gray-600">Terms</a>
        </p>
      </div>
    </main>
  );
}
```

Also create the consent text re-export for client components:

```typescript
// apps/web/src/lib/consent-text.ts
// Re-exports consent text so client components can access it without importing from messaging service.
export const CONSENT_TEXT_V1 =
  'I agree to receive work-related text messages from WALT Services about ' +
  'scheduling, cleaning, maintenance, property access, and urgent operational ' +
  'issues. Message frequency varies. Reply STOP to opt out or HELP for help. ' +
  'Message and data rates may apply.';
```

**Step 2: Typecheck**

```bash
pnpm --filter @walt/web typecheck
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/web/src/app/sms/opt-in/ apps/web/src/lib/consent-text.ts
git commit -m "feat(web): add public SMS opt-in page"
```

---

### Task 17: Public /sms/opt-out page

**Files:**
- Create: `apps/web/src/app/sms/opt-out/page.tsx`
- Create: `apps/web/src/app/sms/opt-out/OptOutForm.tsx`

**Step 1: Create the opt-out form client component**

```tsx
// apps/web/src/app/sms/opt-out/OptOutForm.tsx
'use client';
import { useState } from 'react';

type FormState = 'idle' | 'submitting' | 'success' | 'error' | 'not_found';

export function OptOutForm() {
  const [state, setState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('submitting');

    const form = e.currentTarget;
    const phone = (new FormData(form)).get('phone') as string;

    try {
      const response = await fetch('/api/sms/opt-out', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, sendConfirmation: true }),
      });

      if (response.ok) {
        setState('success');
      } else if (response.status === 404) {
        setState('not_found');
      } else {
        const err = (await response.json()) as { error?: string };
        setErrorMessage(err.error ?? 'Something went wrong. Please try again.');
        setState('error');
      }
    } catch {
      setErrorMessage('Unable to submit. Please check your connection and try again.');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-6 text-center" role="status">
        <p className="text-green-800 font-medium text-lg">You&apos;ve been unsubscribed.</p>
        <p className="text-green-700 mt-2 text-sm">
          You will no longer receive vendor texts from WALT Services. You may receive a final confirmation text.
          Reply START to re-subscribe at any time.
        </p>
      </div>
    );
  }

  if (state === 'not_found') {
    return (
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-6 text-center" role="alert">
        <p className="text-yellow-800 font-medium">Phone number not found.</p>
        <p className="text-yellow-700 mt-2 text-sm">
          No vendor account was found with that phone number. If you believe this is an error,
          contact support@waltservices.com.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          Mobile phone number <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="+1 (555) 000-0000"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
        <p className="mt-1.5 text-xs text-gray-500">Enter the number that receives WALT Services texts.</p>
      </div>

      {state === 'error' && (
        <p className="text-sm text-red-600" role="alert">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      >
        {state === 'submitting' ? 'Processing…' : 'Unsubscribe from vendor texts'}
      </button>
    </form>
  );
}
```

**Step 2: Create the page**

```tsx
// apps/web/src/app/sms/opt-out/page.tsx
import type { Metadata } from 'next';
import { OptOutForm } from './OptOutForm';

export const metadata: Metadata = {
  title: 'Unsubscribe from WALT Services Vendor Texts',
  robots: 'noindex',
};

export default function SmsOptOutPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Unsubscribe from vendor texts</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your mobile number below to stop receiving work-related text messages from WALT Services.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <OptOutForm />
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center">
          You can also opt out by replying STOP to any text from WALT Services.{' '}
          <a href="/sms/privacy" className="underline hover:text-gray-600">Privacy policy</a>
        </p>
      </div>
    </main>
  );
}
```

**Step 3: Typecheck + commit**

```bash
pnpm --filter @walt/web typecheck
git add apps/web/src/app/sms/opt-out/
git commit -m "feat(web): add public SMS opt-out page"
```

---

### Task 18: Static /sms/privacy and /sms/terms pages

**Files:**
- Create: `apps/web/src/app/sms/privacy/page.tsx`
- Create: `apps/web/src/app/sms/terms/page.tsx`

**Step 1: Create privacy page**

```tsx
// apps/web/src/app/sms/privacy/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SMS Privacy Policy — WALT Services',
  robots: 'noindex',
};

export default function SmsPrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">SMS Privacy Policy</h1>

        <div className="prose prose-sm text-gray-700 space-y-6">
          <section>
            <h2 className="text-base font-semibold text-gray-900">What we collect</h2>
            <p>
              When you subscribe to WALT Services vendor text messages, we collect your mobile phone
              number, contact name, and optional company name. We record the date and method of your
              consent for compliance purposes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">How we use your information</h2>
            <p>
              Your phone number is used solely to send work-related operational text messages
              including scheduling updates, property access notifications, maintenance coordination,
              and urgent operational issues. We do not use your number for marketing or promotional
              communications.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">Sharing your information</h2>
            <p>
              We do not sell or share your phone number with third parties for marketing purposes.
              We use Twilio to deliver text messages; your number is transmitted to Twilio solely
              for message delivery.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">Opting out</h2>
            <p>
              You may opt out at any time by replying STOP to any text message from WALT Services,
              or by visiting{' '}
              <a href="/sms/opt-out" className="underline">our opt-out page</a>.
              You will receive a confirmation message when your opt-out is processed.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">Contact</h2>
            <p>
              For questions about this policy or your data, contact{' '}
              <a href="mailto:support@waltservices.com" className="underline">support@waltservices.com</a>.
            </p>
          </section>
        </div>

        <p className="mt-8 text-xs text-gray-400">Last updated: March 2026</p>
      </div>
    </main>
  );
}
```

**Step 2: Create terms page**

```tsx
// apps/web/src/app/sms/terms/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SMS Terms — WALT Services',
  robots: 'noindex',
};

export default function SmsTermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">SMS Messaging Terms</h1>

        <div className="prose prose-sm text-gray-700 space-y-6">
          <section>
            <h2 className="text-base font-semibold text-gray-900">Program description</h2>
            <p>
              WALT Services sends work-related operational text messages to vendors including
              scheduling confirmations, property access information, maintenance coordination, and
              urgent operational notices.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">Message frequency</h2>
            <p>Message frequency varies based on operational activity.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">Costs</h2>
            <p>Message and data rates may apply. Contact your carrier for details.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">How to opt out</h2>
            <p>
              Reply STOP to any message to unsubscribe. You will receive one final confirmation
              message. You will receive no further messages unless you reply START.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">How to get help</h2>
            <p>
              Reply HELP to any message or contact{' '}
              <a href="mailto:support@waltservices.com" className="underline">support@waltservices.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">Carriers</h2>
            <p>
              Carriers are not liable for delayed or undelivered messages. Supported carriers include
              AT&T, Verizon, T-Mobile, and most US carriers.
            </p>
          </section>
        </div>

        <div className="mt-8 space-y-1 text-xs text-gray-400">
          <p>Last updated: March 2026</p>
          <p>
            <a href="/sms/privacy" className="underline hover:text-gray-600">Privacy policy</a>
          </p>
        </div>
      </div>
    </main>
  );
}
```

**Step 3: Typecheck + commit**

```bash
pnpm --filter @walt/web typecheck
git add apps/web/src/app/sms/privacy/ apps/web/src/app/sms/terms/
git commit -m "feat(web): add SMS privacy and terms static pages"
```

---

### Task 19: Admin /admin/vendors page

**Files:**
- Create: `apps/web/src/app/admin/vendors/page.tsx`
- Create: `apps/web/src/app/admin/vendors/VendorTable.tsx`

**Step 1: Create the vendor table client component**

```tsx
// apps/web/src/app/admin/vendors/VendorTable.tsx
'use client';
import { useState } from 'react';

type Vendor = {
  id: string;
  companyName: string;
  contactName: string;
  phoneE164: string;
  status: 'invited' | 'active' | 'opted_out' | 'blocked';
  latestConsentStatus: 'opted_in' | 'opted_out' | 'pending' | null;
  lastConsentAt: string | null;
  lastMessageAt: string | null;
};

const statusBadge: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  opted_out: 'bg-yellow-100 text-yellow-800',
  blocked: 'bg-red-100 text-red-800',
  invited: 'bg-gray-100 text-gray-600',
};

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function VendorTable({ initialVendors }: { initialVendors: Vendor[] }) {
  const [vendors, setVendors] = useState(initialVendors);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, unknown> | null>(null);
  const [disabling, setDisabling] = useState<string | null>(null);

  const filtered = vendors.filter(
    (v) =>
      v.contactName.toLowerCase().includes(query.toLowerCase()) ||
      v.companyName.toLowerCase().includes(query.toLowerCase()) ||
      v.phoneE164.includes(query),
  );

  async function handleDisable(vendorId: string) {
    if (!confirm('Disable messaging for this vendor? This will block all outbound SMS.')) return;
    setDisabling(vendorId);
    try {
      await fetch(`/api/admin/vendors/${vendorId}/disable`, { method: 'PATCH' });
      setVendors((prev) =>
        prev.map((v) => (v.id === vendorId ? { ...v, status: 'blocked' } : v)),
      );
    } finally {
      setDisabling(null);
    }
  }

  async function handleViewHistory(vendorId: string) {
    const response = await fetch(`/api/admin/vendors/${vendorId}/history`);
    const data = await response.json();
    setSelectedId(vendorId);
    setHistory(data as Record<string, unknown>);
  }

  return (
    <>
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name or phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Vendor</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Consent</th>
              <th className="px-4 py-3 text-left">Last consent</th>
              <th className="px-4 py-3 text-left">Last message</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No vendors found
                </td>
              </tr>
            )}
            {filtered.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div>{vendor.contactName}</div>
                  {vendor.companyName && (
                    <div className="text-xs text-gray-500">{vendor.companyName}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 font-mono">{vendor.phoneE164}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge[vendor.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {vendor.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {vendor.latestConsentStatus ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(vendor.lastConsentAt)}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(vendor.lastMessageAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewHistory(vendor.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      History
                    </button>
                    {vendor.status !== 'blocked' && (
                      <button
                        onClick={() => handleDisable(vendor.id)}
                        disabled={disabling === vendor.id}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Disable
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* History drawer */}
      {selectedId && history && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-50">
          <div className="bg-white h-full w-full max-w-lg overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Consent history</h2>
              <button
                onClick={() => { setSelectedId(null); setHistory(null); }}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-4 border border-gray-200">
              {JSON.stringify(history, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Create the page with admin proxy API routes**

First create the admin vendor API routes:

```typescript
// apps/web/src/app/api/admin/vendors/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/authorize';

const gatewayUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const response = await fetch(`${gatewayUrl}/vendors`);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Gateway unavailable' }, { status: 502 });
  }
}
```

```typescript
// apps/web/src/app/api/admin/vendors/[id]/history/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/authorize';

const gatewayUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const response = await fetch(`${gatewayUrl}/vendors/${id}/history`);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Gateway unavailable' }, { status: 502 });
  }
}
```

```typescript
// apps/web/src/app/api/admin/vendors/[id]/disable/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/authorize';

const gatewayUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const response = await fetch(`${gatewayUrl}/vendors/${id}/disable`, { method: 'PATCH' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Gateway unavailable' }, { status: 502 });
  }
}
```

Now create the admin page:

```tsx
// apps/web/src/app/admin/vendors/page.tsx
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { VendorTable } from './VendorTable';

export const metadata: Metadata = { title: 'Vendors — WALT Admin' };

const gatewayUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export default async function AdminVendorsPage() {
  const auth = await getAuthContext();
  if (!auth) redirect('/sign-in');

  let vendors: unknown[] = [];
  try {
    const response = await fetch(`${gatewayUrl}/vendors`, { cache: 'no-store' });
    if (response.ok) {
      const data = (await response.json()) as { items: unknown[] };
      vendors = data.items ?? [];
    }
  } catch {
    // Show empty state if gateway is down
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Vendors</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage vendor SMS consent and messaging status.
        </p>
      </div>
      <VendorTable initialVendors={vendors as Parameters<typeof VendorTable>[0]['initialVendors']} />
    </div>
  );
}
```

**Step 3: Add vendor link to sidebar**

Read `apps/web/src/app/layout.tsx` and add a vendor admin nav link:

```typescript
// In the navLinks array, add:
{ href: '/admin/vendors', label: 'Vendors' },
```

**Step 4: Typecheck + commit**

```bash
pnpm --filter @walt/web typecheck
git add apps/web/src/app/admin/ apps/web/src/app/api/admin/
git commit -m "feat(web): add admin vendors page with consent history and disable controls"
```

---

### Task 20: Update env examples and README

**Files:**
- Modify: `.env.example`
- Modify: `apps/web/.env.example`
- Modify: `README.md`

**Step 1: Update root .env.example**

Add to `.env.example`:

```bash
# Twilio (vendor SMS consent system)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15550000000
TWILIO_MESSAGING_SERVICE_SID=   # optional — leave blank to use phone number directly

# Public app URL (used for Twilio webhook signature validation)
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
```

**Step 2: Update apps/web/.env.example**

Add the same vars to `apps/web/.env.example`.

**Step 3: Update README.md**

Read the existing README.md, then append a new section:

```markdown
## Vendor SMS Consent System

### Local setup

1. Copy env vars: `cp .env.example .env`
2. Fill in `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
3. Run migrations: `pnpm --filter @walt/db db:migrate`
4. Start services: `pnpm dev`

### Opt-in / Opt-out pages

- Opt-in: http://localhost:3000/sms/opt-in
- Opt-out: http://localhost:3000/sms/opt-out
- Privacy: http://localhost:3000/sms/privacy
- Terms: http://localhost:3000/sms/terms
- Admin: http://localhost:3000/admin/vendors

### Testing webhooks locally

**Option A — ngrok:**

```bash
ngrok http 3000
# Copy the HTTPS forwarding URL, e.g. https://abc123.ngrok.io

# Set in Twilio Console → Phone Numbers → your number → Messaging:
#   Webhook URL: https://abc123.ngrok.io/api/twilio/inbound
#   Method: HTTP POST

# Also update your local .env:
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
```

**Option B — Twilio CLI:**

```bash
twilio login
twilio phone-numbers:update <YOUR_TWILIO_NUMBER> \
  --sms-url="https://abc123.ngrok.io/api/twilio/inbound"
```

**Testing STOP/HELP/START keywords:**

Send a text from your personal phone to your Twilio number:
- `STOP` → marks vendor opted_out, visible in /admin/vendors
- `START` → creates new consent record, reactivates vendor
- `HELP` → receives help reply
- Any other text → stored as inbound message in sms_message_logs

**Running messaging service tests:**

```bash
pnpm --filter @walt/service-messaging test
```
```

**Step 4: Commit**

```bash
git add .env.example apps/web/.env.example README.md
git commit -m "docs: add vendor SMS consent env vars and webhook testing instructions"
```

---

### Task 21: Final verification

**Step 1: Run all tests**

```bash
pnpm --filter @walt/service-messaging test
pnpm --filter @walt/web test
pnpm --filter @walt/db typecheck
```

Expected: all pass, no type errors.

**Step 2: Typecheck entire workspace**

```bash
pnpm typecheck
```

Expected: no errors across all packages.

**Step 3: Verify pages load**

Start local services:

```bash
pnpm dev
```

Visit:
- http://localhost:3000/sms/opt-in — form renders, consent text visible above checkbox
- http://localhost:3000/sms/opt-out — phone input renders
- http://localhost:3000/sms/privacy — static page renders
- http://localhost:3000/sms/terms — static page renders
- http://localhost:3000/admin/vendors — redirects to sign-in if not authenticated

**Step 4: Final commit (if needed)**

```bash
git add .
git commit -m "feat: vendor messaging consent system — complete implementation"
```
