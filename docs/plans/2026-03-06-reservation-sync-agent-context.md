# Reservation Sync, Agent Context & Question Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist Hospitable reservations and messages to Postgres, generate Claude reply suggestions on every inbound message, and surface common guest questions via AI analysis.

**Architecture:** Two new Drizzle tables (`walt.reservations`, `walt.messages`) are added to `packages/db`. A bulk-sync admin route backfills all Hospitable history via paginated API calls. The existing webhook is updated to upsert to DB and call Claude for a reply suggestion (stored, never auto-sent). Pages read from DB instead of Hospitable live.

**Tech Stack:** Next.js 15 (App Router), Drizzle ORM + drizzle-kit, `@anthropic-ai/sdk`, Node.js `node:test` runner, `tsx` for running tests.

---

### Task 1: Add `@walt/db` and `@anthropic-ai/sdk` to `apps/web`

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Add dependencies**

```bash
cd apps/web && pnpm add @walt/db @anthropic-ai/sdk
```

**Step 2: Verify typecheck still passes**

```bash
pnpm typecheck
```
Expected: `Tasks: 10 successful, 10 total`

**Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add @walt/db and @anthropic-ai/sdk to apps/web"
```

---

### Task 2: Add `reservations` and `messages` tables to DB schema

**Files:**
- Modify: `packages/db/src/schema.ts`

**Step 1: Add the two tables**

Append to `packages/db/src/schema.ts` after the existing `propertyAccess` table:

```ts
export const reservations = waltSchema.table('reservations', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id'),
  platform: text('platform'),
  platformId: text('platform_id'),
  status: text('status'),
  arrivalDate: timestamp('arrival_date', { withTimezone: true }),
  departureDate: timestamp('departure_date', { withTimezone: true }),
  checkIn: timestamp('check_in', { withTimezone: true }),
  checkOut: timestamp('check_out', { withTimezone: true }),
  bookingDate: timestamp('booking_date', { withTimezone: true }),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  nights: integer('nights'),
  guestId: text('guest_id'),
  guestFirstName: text('guest_first_name'),
  guestLastName: text('guest_last_name'),
  guestEmail: text('guest_email'),
  propertyId: text('property_id'),
  propertyName: text('property_name'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull()
});

export const messages = waltSchema.table(
  'messages',
  {
    id: uuid('id').primaryKey(),
    reservationId: text('reservation_id')
      .notNull()
      .references(() => reservations.id),
    platform: text('platform'),
    body: text('body').notNull(),
    senderType: text('sender_type').notNull(),
    senderFullName: text('sender_full_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    suggestion: text('suggestion'),
    suggestionGeneratedAt: timestamp('suggestion_generated_at', { withTimezone: true }),
    raw: jsonb('raw').notNull()
  },
  (table) => ({
    uniq: uniqueIndex('messages_reservation_created_at_idx').on(table.reservationId, table.createdAt)
  })
);
```

You also need to add `integer`, `uniqueIndex` to the import at the top of schema.ts. The full updated import line:

```ts
import { integer, jsonb, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
```

**Step 2: Typecheck the db package**

```bash
pnpm --filter @walt/db typecheck
```
Expected: passes with no errors.

**Step 3: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add reservations and messages tables"
```

---

### Task 3: Generate and apply the DB migration

**Files:**
- Create: `packages/db/drizzle/0001_reservations_messages.sql` (auto-generated)

**Step 1: Generate the migration**

```bash
pnpm --filter @walt/db db:generate
```
Expected: creates `packages/db/drizzle/0001_*.sql` with the two CREATE TABLE statements.

**Step 2: Apply the migration**

For development with `DATABASE_URL` set:
```bash
pnpm --filter @walt/db db:migrate
```

If `DATABASE_URL` is not set locally, use push instead:
```bash
pnpm --filter @walt/db db:push
```

**Step 3: Commit the generated migration**

```bash
git add packages/db/drizzle/
git commit -m "feat(db): migration 0001 - reservations and messages tables"
```

---

### Task 4: Create DB singleton for `apps/web`

**Files:**
- Create: `apps/web/src/lib/db.ts`

**Step 1: Create the singleton**

```ts
import { createDb } from '@walt/db';

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createDb> };

export const db = globalForDb.db ?? createDb(process.env.DATABASE_URL!);

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}
```

The `globalThis` singleton pattern prevents creating a new connection pool on every hot-reload in Next.js dev mode.

**Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: passes.

**Step 3: Commit**

```bash
git add apps/web/src/lib/db.ts
git commit -m "feat(web): add DB singleton for Next.js"
```

---

### Task 5: Create Hospitable normalization helpers + tests

**Files:**
- Create: `apps/web/src/lib/hospitable-normalize.ts`
- Create: `apps/web/src/lib/hospitable-normalize.test.ts`

**Step 1: Write the failing tests first**

Create `apps/web/src/lib/hospitable-normalize.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeReservation, normalizeMessage } from './hospitable-normalize';

test('normalizeReservation extracts core fields from Hospitable v2 payload', () => {
  const raw = {
    id: 'abc-123',
    conversation_id: 'conv-1',
    platform: 'airbnb',
    platform_id: 'BK001',
    status: 'booking',
    arrival_date: '2025-06-01T00:00:00Z',
    departure_date: '2025-06-05T00:00:00Z',
    check_in: '2025-06-01T15:00:00Z',
    check_out: '2025-06-05T11:00:00Z',
    booking_date: '2025-05-01T00:00:00Z',
    last_message_at: '2025-05-15T00:00:00Z',
    nights: 4,
    guest: { id: 'g1', first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
    properties: [{ id: 'prop-1', name: 'Beach House' }]
  };

  const result = normalizeReservation(raw);
  assert.equal(result.id, 'abc-123');
  assert.equal(result.platform, 'airbnb');
  assert.equal(result.guestFirstName, 'Jane');
  assert.equal(result.guestLastName, 'Doe');
  assert.equal(result.propertyId, 'prop-1');
  assert.equal(result.propertyName, 'Beach House');
  assert.equal(result.nights, 4);
});

test('normalizeReservation handles missing guest and properties gracefully', () => {
  const raw = { id: 'xyz', status: 'cancelled' };
  const result = normalizeReservation(raw);
  assert.equal(result.id, 'xyz');
  assert.equal(result.guestFirstName, null);
  assert.equal(result.propertyId, null);
});

test('normalizeMessage extracts core fields from Hospitable v2 message payload', () => {
  const raw = {
    reservation_id: 'res-1',
    platform: 'airbnb',
    body: 'What time is check-in?',
    sender_type: 'guest',
    sender: { full_name: 'Jane Doe' },
    created_at: '2025-05-10T10:00:00Z'
  };

  const result = normalizeMessage(raw, 'res-1');
  assert.equal(result.reservationId, 'res-1');
  assert.equal(result.body, 'What time is check-in?');
  assert.equal(result.senderType, 'guest');
  assert.equal(result.senderFullName, 'Jane Doe');
});

test('normalizeMessage returns null when body is empty', () => {
  const raw = { reservation_id: 'res-1', body: '', sender_type: 'guest', created_at: '2025-05-10T10:00:00Z' };
  const result = normalizeMessage(raw, 'res-1');
  assert.equal(result, null);
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm --filter @walt/web test
```
Expected: FAIL — `normalizeReservation` and `normalizeMessage` are not defined.

**Step 3: Implement the normalization helpers**

Create `apps/web/src/lib/hospitable-normalize.ts`:

```ts
import type { reservations, messages } from '@walt/db';
import type { InferInsertModel } from 'drizzle-orm';

type ReservationInsert = InferInsertModel<typeof reservations>;
type MessageInsert = InferInsertModel<typeof messages>;

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function ts(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export function normalizeReservation(raw: Record<string, unknown>): Omit<ReservationInsert, 'syncedAt'> {
  const guest = (raw.guest ?? {}) as Record<string, unknown>;
  const props = Array.isArray(raw.properties) ? (raw.properties as Record<string, unknown>[]) : [];
  const firstProp = props[0] ?? {};

  return {
    id: String(raw.id),
    conversationId: str(raw.conversation_id),
    platform: str(raw.platform),
    platformId: str(raw.platform_id),
    status: str(raw.status),
    arrivalDate: ts(raw.arrival_date),
    departureDate: ts(raw.departure_date),
    checkIn: ts(raw.check_in),
    checkOut: ts(raw.check_out),
    bookingDate: ts(raw.booking_date),
    lastMessageAt: ts(raw.last_message_at),
    nights: num(raw.nights),
    guestId: str(guest.id),
    guestFirstName: str(guest.first_name),
    guestLastName: str(guest.last_name),
    guestEmail: str(guest.email),
    propertyId: str(firstProp.id),
    propertyName: str(firstProp.name),
    raw
  };
}

export function normalizeMessage(
  raw: Record<string, unknown>,
  reservationId: string
): Omit<MessageInsert, 'id'> | null {
  const body = str(raw.body);
  if (!body) return null;

  const sender = (raw.sender ?? {}) as Record<string, unknown>;
  const createdAt = ts(raw.created_at);
  if (!createdAt) return null;

  return {
    reservationId,
    platform: str(raw.platform),
    body,
    senderType: str(raw.sender_type) ?? 'unknown',
    senderFullName: str(sender.full_name),
    createdAt,
    suggestion: null,
    suggestionGeneratedAt: null,
    raw
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @walt/web test
```
Expected: 4 passing.

**Step 5: Commit**

```bash
git add apps/web/src/lib/hospitable-normalize.ts apps/web/src/lib/hospitable-normalize.test.ts
git commit -m "feat(web): add Hospitable normalization helpers with tests"
```

---

### Task 6: Add permissions for `/api/admin/` routes

**Files:**
- Modify: `apps/web/src/lib/auth/permissions.ts`

**Step 1: Add admin route mapping**

In `getPermissionForApiRoute`, add before the final `return 'ops.write'`:

```ts
if (pathname.startsWith('/api/admin/')) {
  return 'platform.configure';
}
```

`platform.configure` is only held by the `owner` role — restricts admin endpoints to owners.

**Step 2: Typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/auth/permissions.ts
git commit -m "feat(web): restrict /api/admin/* routes to platform.configure permission"
```

---

### Task 7: Create bulk sync route

**Files:**
- Create: `apps/web/src/app/api/admin/sync-hospitable/route.ts`

**Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { reservations, messages } from '@walt/db';
import { db } from '@/lib/db';
import { getHospitableApiConfig } from '@/lib/integrations-env';
import { normalizeReservation, normalizeMessage } from '@/lib/hospitable-normalize';

type HospitableListResponse = {
  data: Record<string, unknown>[];
  links?: { next?: string | null };
};

async function fetchAllReservations(config: { apiKey: string; baseUrl: string }) {
  const all: Record<string, unknown>[] = [];
  let url: string | null = new URL('/v2/reservations?limit=100&includes[]=guest&includes[]=properties', config.baseUrl).toString();

  while (url) {
    const res = await fetch(url, {
      headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
    });
    if (!res.ok) throw new Error(`Hospitable reservations returned ${res.status}`);
    const body = (await res.json()) as HospitableListResponse;
    all.push(...(body.data ?? []));
    url = body.links?.next ?? null;
  }

  return all;
}

async function fetchMessagesForReservation(config: { apiKey: string; baseUrl: string }, reservationId: string) {
  const url = new URL(`/v2/reservations/${reservationId}/messages?limit=100`, config.baseUrl);
  const res = await fetch(url, {
    headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: Record<string, unknown>[] };
  return body.data ?? [];
}

export async function POST() {
  const config = getHospitableApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'Hospitable API not configured.' },
      { status: 503 }
    );
  }

  const rawReservations = await fetchAllReservations(config);
  const now = new Date();
  let reservationCount = 0;
  let messageCount = 0;

  for (const raw of rawReservations) {
    const normalized = normalizeReservation(raw);
    await db
      .insert(reservations)
      .values({ ...normalized, syncedAt: now })
      .onConflictDoUpdate({
        target: reservations.id,
        set: { ...normalized, syncedAt: now }
      });
    reservationCount++;

    const rawMessages = await fetchMessagesForReservation(config, normalized.id);
    for (const msg of rawMessages) {
      const normalizedMsg = normalizeMessage(msg, normalized.id);
      if (!normalizedMsg) continue;
      await db
        .insert(messages)
        .values({ id: uuidv4(), ...normalizedMsg })
        .onConflictDoNothing();
      messageCount++;
    }
  }

  return NextResponse.json({ reservations: reservationCount, messages: messageCount });
}
```

Note: `uuid` is not in `apps/web` yet. Add it:
```bash
cd apps/web && pnpm add uuid && pnpm add -D @types/uuid
```

**Step 2: Typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/app/api/admin/sync-hospitable/route.ts
git commit -m "feat(web): add POST /api/admin/sync-hospitable bulk import route"
```

---

### Task 8: Update webhook to persist to DB + generate Claude suggestion

**Files:**
- Modify: `apps/web/src/app/api/integrations/hospitable/route.ts`

**Step 1: Replace the existing POST handler body**

The existing handler calls `ingestHospitableMessageInSingleton`. Replace that logic (keep the HMAC verification) to instead:
1. Fetch the full reservation from Hospitable
2. Upsert reservation + message to DB
3. Call Claude to generate a suggestion
4. Store suggestion on the message row

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { reservations, messages } from '@walt/db';
import { eq, and } from 'drizzle-orm';

import { handleApiError } from '@/lib/secure-logger';
import { getHospitableApiConfig } from '@/lib/integrations-env';
import { db } from '@/lib/db';
import { normalizeReservation, normalizeMessage } from '@/lib/hospitable-normalize';

const webhookSchema = z.object({
  reservationId: z.string().min(1),
  message: z.string().min(1),
  senderType: z.string().default('guest'),
  senderName: z.string().optional(),
  sentAt: z.string().optional()
});

function verifySignature(request: Request, rawBody: string) {
  const secret = process.env.HOSPITABLE_WEBHOOK_SECRET?.trim();
  if (!secret) return;
  const timestamp = request.headers.get('x-hospitable-timestamp');
  const signature = request.headers.get('x-hospitable-signature');
  if (!timestamp || !signature) throw new Error('Missing webhook signature headers');
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const providedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error('Invalid webhook signature');
  }
}

async function fetchReservation(config: { apiKey: string; baseUrl: string }, reservationId: string) {
  const url = new URL(`/v2/reservations/${reservationId}?includes[]=guest&includes[]=properties`, config.baseUrl);
  const res = await fetch(url, {
    headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: Record<string, unknown> };
  return body.data ?? null;
}

async function generateSuggestion(reservation: Record<string, unknown>, messageBody: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const raw = reservation;
  const guestName = ((raw.guest as Record<string, unknown>)?.first_name as string) ?? 'the guest';
  const propertyName = ((raw.properties as Record<string, unknown>[])?.[0]?.name as string) ?? 'the property';
  const checkIn = raw.check_in ? new Date(raw.check_in as string).toLocaleDateString() : 'unknown';
  const checkOut = raw.check_out ? new Date(raw.check_out as string).toLocaleDateString() : 'unknown';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: `You are a helpful short-term rental host assistant. Draft a warm, concise reply to a guest message.
Property: ${propertyName}
Guest: ${guestName}
Check-in: ${checkIn}
Check-out: ${checkOut}
Reply in the same language as the guest message. Keep it under 3 sentences unless the question requires more detail.`,
    messages: [{ role: 'user', content: messageBody }]
  });

  const block = response.content[0];
  return block?.type === 'text' ? block.text : null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    verifySignature(request, rawBody);

    const body = JSON.parse(rawBody) as unknown;
    const parsed = webhookSchema.parse(body);
    const config = getHospitableApiConfig();

    // Upsert reservation if API is configured
    let reservationRaw: Record<string, unknown> | null = null;
    if (config) {
      reservationRaw = await fetchReservation(config, parsed.reservationId);
      if (reservationRaw) {
        const normalized = normalizeReservation(reservationRaw);
        await db
          .insert(reservations)
          .values({ ...normalized, syncedAt: new Date() })
          .onConflictDoUpdate({
            target: reservations.id,
            set: { ...normalized, syncedAt: new Date() }
          });
      }
    }

    // Insert message
    const msgRaw: Record<string, unknown> = {
      reservation_id: parsed.reservationId,
      body: parsed.message,
      sender_type: parsed.senderType,
      sender: { full_name: parsed.senderName ?? '' },
      created_at: parsed.sentAt ?? new Date().toISOString()
    };
    const normalizedMsg = normalizeMessage(msgRaw, parsed.reservationId);

    if (normalizedMsg) {
      const msgId = uuidv4();
      await db
        .insert(messages)
        .values({ id: msgId, ...normalizedMsg })
        .onConflictDoNothing();

      // Generate suggestion for inbound guest messages
      if (parsed.senderType === 'guest' && reservationRaw) {
        const suggestion = await generateSuggestion(reservationRaw, parsed.message);
        if (suggestion) {
          await db
            .update(messages)
            .set({ suggestion, suggestionGeneratedAt: new Date() })
            .where(eq(messages.id, msgId));
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    const status =
      error instanceof Error &&
      (error.message === 'Missing webhook signature headers' || error.message === 'Invalid webhook signature')
        ? 401
        : 400;
    return handleApiError({ error, route: '/api/integrations/hospitable', status });
  }
}
```

**Step 2: Add `ANTHROPIC_API_KEY` to `.env.example`**

```
ANTHROPIC_API_KEY=sk-ant-replace-me
```

**Step 3: Typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/api/integrations/hospitable/route.ts apps/web/.env.example
git commit -m "feat(web): webhook persists to DB and generates Claude reply suggestion"
```

---

### Task 9: Create question analysis route

**Files:**
- Create: `apps/web/src/app/api/admin/analyze-questions/route.ts`

**Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { messages } from '@walt/db';
import { db } from '@/lib/db';

type QuestionCategory = {
  name: string;
  count: number;
  examples: string[];
  suggestedAnswer: string;
};

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 503 });
  }

  const inboundMessages = await db
    .select({ body: messages.body })
    .from(messages)
    .where(eq(messages.senderType, 'guest'));

  if (inboundMessages.length === 0) {
    return NextResponse.json({ categories: [] });
  }

  const messageList = inboundMessages.map((m, i) => `${i + 1}. ${m.body}`).join('\n');

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: `You are analyzing guest messages for a short-term rental host.
Identify the most common question categories, count how many messages fall into each,
provide 2-3 example messages per category, and draft a suggested host answer for each.
Return valid JSON only: { "categories": [{ "name": string, "count": number, "examples": string[], "suggestedAnswer": string }] }`,
    messages: [
      {
        role: 'user',
        content: `Here are ${inboundMessages.length} guest messages:\n\n${messageList}\n\nReturn JSON only.`
      }
    ]
  });

  const block = response.content[0];
  if (block?.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected Claude response' }, { status: 502 });
  }

  try {
    const parsed = JSON.parse(block.text) as { categories: QuestionCategory[] };
    return NextResponse.json({ categories: parsed.categories, totalMessages: inboundMessages.length });
  } catch {
    return NextResponse.json({ error: 'Failed to parse Claude response', raw: block.text }, { status: 502 });
  }
}
```

**Step 2: Typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/app/api/admin/analyze-questions/route.ts
git commit -m "feat(web): add POST /api/admin/analyze-questions Claude-powered analysis"
```

---

### Task 10: Update Reservations and Inbox pages to read from DB

**Files:**
- Modify: `apps/web/src/app/reservations/page.tsx`
- Modify: `apps/web/src/app/inbox/page.tsx`

**Step 1: Update reservations page to query DB directly**

Replace the `fetchReservations` function and component body with:

```ts
import { db } from '@/lib/db';
import { reservations } from '@walt/db';
import { desc } from 'drizzle-orm';

// In the server component:
const rows = await db
  .select()
  .from(reservations)
  .orderBy(desc(reservations.arrivalDate))
  .limit(200);
```

Map `rows` to the table — columns are now `row.guestFirstName`, `row.guestLastName`, `row.propertyName`, `row.checkIn`, `row.checkOut`, `row.status`.

If `rows.length === 0`, show: "No reservations synced yet. Run the sync from Settings."

**Step 2: Update inbox page to query DB directly**

```ts
import { db } from '@/lib/db';
import { messages, reservations } from '@walt/db';
import { desc, eq } from 'drizzle-orm';

const rows = await db
  .select({
    id: messages.id,
    body: messages.body,
    senderType: messages.senderType,
    senderFullName: messages.senderFullName,
    createdAt: messages.createdAt,
    suggestion: messages.suggestion,
    reservationId: messages.reservationId,
    guestFirstName: reservations.guestFirstName,
    guestLastName: reservations.guestLastName
  })
  .from(messages)
  .leftJoin(reservations, eq(messages.reservationId, reservations.id))
  .where(eq(messages.senderType, 'guest'))
  .orderBy(desc(messages.createdAt))
  .limit(100);
```

Show `suggestion` below the message body in a light-blue callout box if present.

**Step 3: Typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/reservations/page.tsx apps/web/src/app/inbox/page.tsx
git commit -m "feat(web): reservations and inbox pages read from DB instead of Hospitable live"
```

---

### Task 11: Add Questions page and nav link

**Files:**
- Create: `apps/web/src/app/questions/page.tsx`
- Modify: `apps/web/src/app/layout.tsx`

**Step 1: Create questions page**

```tsx
'use client';
import { useState } from 'react';

type Category = {
  name: string;
  count: number;
  examples: string[];
  suggestedAnswer: string;
};

export default function QuestionsPage() {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/analyze-questions', { method: 'POST' });
      const data = await res.json() as { categories?: Category[]; error?: string; totalMessages?: number };
      if (data.error) { setError(data.error); return; }
      setCategories(data.categories ?? []);
      setTotal(data.totalMessages ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Common Questions</h1>
          {total !== null && <p className="text-sm text-gray-500 mt-1">Analysed {total} guest messages</p>}
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? 'Analysing…' : 'Run Analysis'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm mb-6">{error}</div>
      )}

      {categories.length === 0 && !loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          Click "Run Analysis" to discover common guest questions.
        </div>
      )}

      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.name} className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium text-gray-900">{cat.name}</h2>
              <span className="text-xs text-gray-500">{cat.count} message{cat.count !== 1 ? 's' : ''}</span>
            </div>
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Examples</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {cat.examples.map((ex, i) => <li key={i} className="truncate">"{ex}"</li>)}
              </ul>
            </div>
            <div className="rounded bg-blue-50 border border-blue-100 p-3">
              <p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-1">Suggested Answer</p>
              <p className="text-sm text-blue-900">{cat.suggestedAnswer}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Add Questions to sidebar nav in layout.tsx**

In the `navLinks` array in `apps/web/src/app/layout.tsx`, add:
```ts
{ href: '/questions', label: 'Questions' }
```

**Step 3: Typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/questions/page.tsx apps/web/src/app/layout.tsx
git commit -m "feat(web): add Questions page with Claude-powered guest question analysis"
```

---

### Task 12: Final verification

**Step 1: Run typecheck**

```bash
pnpm typecheck
```
Expected: `Tasks: 10 successful, 10 total`

**Step 2: Run lint**

```bash
pnpm lint
```
Expected: `Tasks: 9 successful, 9 total`

**Step 3: Run tests**

```bash
pnpm --filter @walt/web test
```
Expected: 4 passing tests for normalization helpers.

**Step 4: Verify env vars needed**

Make sure these are set in production:
- `DATABASE_URL` — Postgres connection string
- `HOSPITABLE_API_KEY` — Hospitable bearer token
- `HOSPITABLE_BASE_URL` — `https://public.api.hospitable.com`
- `ANTHROPIC_API_KEY` — Anthropic API key for Claude
- `HOSPITABLE_WEBHOOK_SECRET` — for webhook HMAC verification

**Step 5: Trigger bulk sync**

After deploying, call the sync endpoint once as an owner-role user:
```bash
curl -X POST https://ai.walt-services.com/api/admin/sync-hospitable \
  -H "Cookie: <your-session-cookie>"
```

**Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: final typecheck and lint fixes"
```
