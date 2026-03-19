# Daily Operations Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/today` daily operations dashboard showing turnovers, tasks due, and AI-generated suggestions from guest messages and upcoming reservations, with SMS and email reminders.

**Architecture:** Server-rendered `/today` page fetches turnovers and tasks at request time; a client `SuggestionsStack` component fetches pending AI suggestions separately so the server shell loads fast. Three Vercel Cron Jobs drive suggestion generation (daily at 7am CST, every 30min for messages) and reminder delivery (every 15min). All business logic lives in `handler.ts` and `lib/` files — route files only export HTTP methods, matching the CLAUDE.md rule.

**Tech Stack:** Next.js 15 (App Router), Drizzle ORM, PostgreSQL, Clerk (auth + owner lookup), Twilio (SMS), Resend (email), Vercel Cron Jobs, Claude API (message classification), Node `node:test` for tests.

---

## File Map

**New files:**
- `packages/contracts/src/task-suggestions.ts` — Zod schemas + types for `TaskSuggestion` and `TaskReminder`
- `packages/contracts/src/index.ts` — add exports (modify existing)
- `packages/db/src/schema.ts` — add columns + new tables (modify existing, do not redeclare)
- `packages/db/drizzle/0012_daily_dashboard.sql` — migration
- `apps/web/src/lib/ai/classify-message.ts` — AI classification: message body → suggested task or null
- `apps/web/src/lib/ai/classify-message.test.ts`
- `apps/web/src/lib/reminders/resolve-owner-contact.ts` — looks up org owner phone/email via Clerk API
- `apps/web/src/lib/reminders/send-reminder.ts` — sends one reminder via configured channels
- `apps/web/src/lib/reminders/send-reminder.test.ts`
- `apps/web/src/app/api/task-suggestions/handler.ts` — `handleListTaskSuggestions`
- `apps/web/src/app/api/task-suggestions/route.ts` — GET only
- `apps/web/src/app/api/task-suggestions/route.test.ts`
- `apps/web/src/app/api/task-suggestions/[id]/accept/handler.ts` — `handleAcceptSuggestion`
- `apps/web/src/app/api/task-suggestions/[id]/accept/route.ts` — POST only
- `apps/web/src/app/api/task-suggestions/[id]/accept/route.test.ts`
- `apps/web/src/app/api/task-suggestions/[id]/dismiss/handler.ts` — `handleDismissSuggestion`
- `apps/web/src/app/api/task-suggestions/[id]/dismiss/route.ts` — POST only
- `apps/web/src/app/api/task-suggestions/[id]/dismiss/route.test.ts`
- `apps/web/src/app/api/cron/daily-suggestions/handler.ts` — reservation suggestion logic
- `apps/web/src/app/api/cron/daily-suggestions/handler.test.ts`
- `apps/web/src/app/api/cron/daily-suggestions/route.ts` — POST only
- `apps/web/src/app/api/cron/scan-messages/handler.ts` — message scan logic
- `apps/web/src/app/api/cron/scan-messages/handler.test.ts`
- `apps/web/src/app/api/cron/scan-messages/route.ts` — POST only
- `apps/web/src/app/api/cron/send-reminders/handler.ts` — reminder delivery logic
- `apps/web/src/app/api/cron/send-reminders/handler.test.ts`
- `apps/web/src/app/api/cron/send-reminders/route.ts` — POST only
- `apps/web/src/app/today/page.tsx` — server component: fetches turnovers + tasks, renders shell
- `apps/web/src/app/today/SuggestionsStack.tsx` — client component: fetches + renders suggestion cards
- `apps/web/src/app/today/SuggestionCard.tsx` — single suggestion card with inline accept form

**Modified files:**
- `apps/web/src/app/page.tsx` — redirect `/` → `/today`
- `apps/web/src/lib/nav-links.ts` — prepend `{ href: '/today', label: 'Today' }`
- `apps/web/src/lib/nav-links.test.ts` — add assertion that Today is first
- `vercel.json` — add three cron schedules (create if absent)

---

## Task 1: DB Schema + Migration

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0012_daily_dashboard.sql`
- Update: `packages/db/drizzle/meta/_journal.json`

- [ ] **Step 1: Verify no 0012 migration already exists**

```bash
ls packages/db/drizzle/ | grep 0012
```

Expected: no output. If a file exists, investigate before proceeding.

- [ ] **Step 2: Add `has_pool` to the existing `properties` table definition**

In `packages/db/src/schema.ts`, find the `properties` table and add one column after `syncedAt`:

```typescript
hasPool: boolean('has_pool').notNull().default(false),
```

- [ ] **Step 3: Add `suggestion_scanned_at` to the existing `messages` table definition**

Find the `messages` table in `schema.ts`. Add after the last column:

```typescript
suggestionScannedAt: timestamp('suggestion_scanned_at', { withTimezone: true }),
```

- [ ] **Step 4: Add `taskSuggestions` table**

Append after all existing table definitions (do not redeclare any existing table):

```typescript
export const taskSuggestions = waltSchema.table(
  'task_suggestions',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id').notNull(),
    propertyId: text('property_id').notNull(),
    propertyName: text('property_name').notNull(),
    reservationId: text('reservation_id').notNull(),
    messageId: uuid('message_id'),
    title: text('title').notNull(),
    description: text('description'),
    suggestedDueDate: timestamp('suggested_due_date', { withTimezone: true }),
    source: text('source').notNull(), // 'message' | 'reservation'
    status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'dismissed'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    orgStatusIdx: index('task_suggestions_org_status_idx').on(
      table.organizationId,
      table.status,
    ),
    uniqueConstraint: uniqueIndex('task_suggestions_org_reservation_title_idx').on(
      table.organizationId,
      table.reservationId,
      table.title,
    ),
  }),
);
```

- [ ] **Step 5: Add `taskReminders` table**

`task_reminders` stores `taskTitle` and `propertyName` directly so the reminder cron can send meaningful messages without fetching from the gateway:

```typescript
export const taskReminders = waltSchema.table(
  'task_reminders',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    taskId: text('task_id').notNull(),
    organizationId: text('organization_id').notNull(),
    taskTitle: text('task_title').notNull(),
    propertyName: text('property_name').notNull(),
    channels: text('channels').array().notNull(),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    pendingIdx: index('task_reminders_pending_idx')
      .on(table.scheduledFor)
      .where(sql`${table.sentAt} IS NULL`),
  }),
);
```

- [ ] **Step 6: Write the migration SQL**

Create `packages/db/drizzle/0012_daily_dashboard.sql`:

```sql
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "has_pool" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "walt"."messages" ADD COLUMN IF NOT EXISTS "suggestion_scanned_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."task_suggestions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "property_id" text NOT NULL,
  "property_name" text NOT NULL,
  "reservation_id" text NOT NULL,
  "message_id" uuid,
  "title" text NOT NULL,
  "description" text,
  "suggested_due_date" timestamp with time zone,
  "source" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_suggestions_org_status_idx"
  ON "walt"."task_suggestions" ("organization_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_suggestions_org_reservation_title_idx"
  ON "walt"."task_suggestions" ("organization_id", "reservation_id", "title");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."task_reminders" (
  "id" uuid PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "organization_id" text NOT NULL,
  "task_title" text NOT NULL,
  "property_name" text NOT NULL,
  "channels" text[] NOT NULL,
  "scheduled_for" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_reminders_pending_idx"
  ON "walt"."task_reminders" ("scheduled_for")
  WHERE "sent_at" IS NULL;
```

- [ ] **Step 7: Register migration in journal**

Open `packages/db/drizzle/meta/_journal.json`. Add after the last entry (idx 11):

```json
{
  "idx": 12,
  "version": "7",
  "when": 1773934200000,
  "tag": "0012_daily_dashboard",
  "breakpoints": true
}
```

- [ ] **Step 8: Run typecheck to verify schema compiles**

```bash
pnpm turbo run typecheck --filter=@walt/db
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/0012_daily_dashboard.sql packages/db/drizzle/meta/_journal.json
git commit -m "feat(db): add task_suggestions, task_reminders, has_pool, suggestion_scanned_at"
```

---

## Task 2: Contracts

**Files:**
- Create: `packages/contracts/src/task-suggestions.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Create `task-suggestions.ts`**

```typescript
import { z } from 'zod';

export const taskSuggestionSourceSchema = z.enum(['message', 'reservation']);
export const taskSuggestionStatusSchema = z.enum(['pending', 'accepted', 'dismissed']);

export const taskSuggestionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  propertyId: z.string(),
  propertyName: z.string(),
  reservationId: z.string(),
  messageId: z.string().uuid().nullish(),
  title: z.string(),
  description: z.string().nullish(),
  suggestedDueDate: z.string().datetime().nullish(),
  source: taskSuggestionSourceSchema,
  status: taskSuggestionStatusSchema,
  createdAt: z.string().datetime(),
});

export const taskReminderSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string(),
  organizationId: z.string(),
  taskTitle: z.string(),
  propertyName: z.string(),
  channels: z.array(z.enum(['sms', 'email'])),
  scheduledFor: z.string().datetime(),
  sentAt: z.string().datetime().nullish(),
  createdAt: z.string().datetime(),
});

export const acceptSuggestionInputSchema = z.object({
  reminderChannels: z.array(z.enum(['sms', 'email'])).optional(),
  reminderTime: z.string().datetime().optional(),
});

export type TaskSuggestion = z.infer<typeof taskSuggestionSchema>;
export type TaskReminder = z.infer<typeof taskReminderSchema>;
export type AcceptSuggestionInput = z.infer<typeof acceptSuggestionInputSchema>;
```

- [ ] **Step 2: Export from index (with .js extension)**

In `packages/contracts/src/index.ts`, add — note the `.js` extension, matching all existing exports in this file:

```typescript
export * from './task-suggestions.js';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm turbo run typecheck --filter=@walt/contracts
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/task-suggestions.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add TaskSuggestion and TaskReminder types"
```

---

## Task 3: AI Message Classification

**Files:**
- Create: `apps/web/src/lib/ai/classify-message.ts`
- Create: `apps/web/src/lib/ai/classify-message.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `apps/web/src/lib/ai/classify-message.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMessage } from './classify-message';

type FakeClassify = (prompt: string) => Promise<string>;

void test('pool/hot tub mention → pool heating suggestion', async () => {
  const fakeAi: FakeClassify = async () =>
    JSON.stringify({
      title: 'Start pool heating before Johnson family arrival',
      description: 'Guest mentioned pool and hot tub use.',
      hasSuggestedTask: true,
    });

  const result = await classifyMessage(
    {
      body: "We're really looking forward to using the pool and hot tub!",
      guestFirstName: 'Johnson family',
      propertyName: 'Palmera',
      arrivalDate: '2026-03-20',
    },
    { callAi: fakeAi },
  );

  assert.ok(result !== null);
  assert.ok(result.title.toLowerCase().includes('pool'));
});

void test('generic message → null', async () => {
  const fakeAi: FakeClassify = async () =>
    JSON.stringify({ hasSuggestedTask: false });

  const result = await classifyMessage(
    {
      body: 'Thank you for the quick reply!',
      guestFirstName: 'Smith',
      propertyName: 'Casa Blanca',
      arrivalDate: '2026-03-21',
    },
    { callAi: fakeAi },
  );

  assert.equal(result, null);
});

void test('early check-in request → check-in suggestion', async () => {
  const fakeAi: FakeClassify = async () =>
    JSON.stringify({
      title: 'Arrange early check-in for Smith',
      description: 'Guest requested early check-in around 11am.',
      hasSuggestedTask: true,
    });

  const result = await classifyMessage(
    {
      body: 'Is it possible to check in early, around 11am?',
      guestFirstName: 'Smith',
      propertyName: 'Casa Blanca',
      arrivalDate: '2026-03-21',
    },
    { callAi: fakeAi },
  );

  assert.ok(result !== null);
  assert.ok(result.title.toLowerCase().includes('check-in'));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && node --import tsx/esm --test src/lib/ai/classify-message.test.ts 2>&1 | head -10
```

Expected: module not found error.

- [ ] **Step 3: Implement `classify-message.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk';

export type MessageContext = {
  body: string;
  guestFirstName: string;
  propertyName: string;
  arrivalDate: string; // YYYY-MM-DD
};

export type SuggestedTask = {
  title: string;
  description: string;
};

type ClassifyDeps = {
  callAi?: (prompt: string) => Promise<string>;
};

const SYSTEM_PROMPT = `You are a property management assistant. Given a guest message, decide if a host action is needed.

Actionable signals: pool/spa/hot-tub requests, early check-in, late check-out, extra supplies (towels, cribs, etc.), special occasions.

Respond ONLY with JSON in this format:
- If action needed: {"hasSuggestedTask": true, "title": "...", "description": "..."}
- If no action: {"hasSuggestedTask": false}

Keep title concise (under 60 chars). Include the guest name and property in the title.`;

async function defaultCallAi(prompt: string): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = response.content[0];
  if (block?.type !== 'text') throw new Error('Unexpected AI response type');
  return block.text;
}

export async function classifyMessage(
  context: MessageContext,
  deps: ClassifyDeps = {},
): Promise<SuggestedTask | null> {
  const callAi = deps.callAi ?? defaultCallAi;

  const prompt = `Property: ${context.propertyName}
Guest first name: ${context.guestFirstName}
Arrival date: ${context.arrivalDate}
Message: "${context.body}"`;

  const raw = await callAi(prompt);

  let parsed: { hasSuggestedTask: boolean; title?: string; description?: string };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return null;
  }

  if (!parsed.hasSuggestedTask || !parsed.title) return null;
  return { title: parsed.title, description: parsed.description ?? '' };
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && node --import tsx/esm --test src/lib/ai/classify-message.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ai/classify-message.ts apps/web/src/lib/ai/classify-message.test.ts
git commit -m "feat(ai): add message classification for task suggestions"
```

---

## Task 4: Task Suggestion API Routes

**Files:**
- Create: `apps/web/src/app/api/task-suggestions/handler.ts`
- Create: `apps/web/src/app/api/task-suggestions/route.ts`
- Create: `apps/web/src/app/api/task-suggestions/route.test.ts`
- Create: `apps/web/src/app/api/task-suggestions/[id]/accept/handler.ts`
- Create: `apps/web/src/app/api/task-suggestions/[id]/accept/route.ts`
- Create: `apps/web/src/app/api/task-suggestions/[id]/accept/route.test.ts`
- Create: `apps/web/src/app/api/task-suggestions/[id]/dismiss/handler.ts`
- Create: `apps/web/src/app/api/task-suggestions/[id]/dismiss/route.ts`
- Create: `apps/web/src/app/api/task-suggestions/[id]/dismiss/route.test.ts`

- [ ] **Step 1: Write tests for list handler**

Create `apps/web/src/app/api/task-suggestions/route.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { handleListTaskSuggestions } from './handler';

const authCtx = { orgId: 'org-1', userId: 'user-1', role: 'owner' as const };

void test('returns pending suggestions for org, newest first', async () => {
  const response = await handleListTaskSuggestions(
    new Request('http://localhost/api/task-suggestions'),
    authCtx,
    {
      querySuggestions: async ({ orgId, status }) => {
        assert.equal(orgId, 'org-1');
        assert.equal(status, 'pending');
        return [
          {
            id: 'sug-1',
            organizationId: 'org-1',
            propertyId: 'prop-1',
            propertyName: 'Palmera',
            reservationId: 'res-1',
            messageId: null,
            title: 'Start pool heating',
            description: null,
            suggestedDueDate: null,
            source: 'reservation',
            status: 'pending',
            createdAt: new Date('2026-03-19T12:00:00Z'),
          },
        ];
      },
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as { suggestions: Array<{ id: string }> };
  assert.equal(body.suggestions[0]?.id, 'sug-1');
});
```

- [ ] **Step 2: Implement list handler**

Create `apps/web/src/app/api/task-suggestions/handler.ts`:

```typescript
import { desc, eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { taskSuggestions } from '@walt/db';
import type { AuthContext } from '@walt/contracts';

type ListDeps = {
  querySuggestions?: (args: { orgId: string; status: string }) => Promise<unknown[]>;
};

async function defaultQuerySuggestions({ orgId, status }: { orgId: string; status: string }) {
  const { db } = await import('@/lib/db');
  return db
    .select()
    .from(taskSuggestions)
    .where(
      and(
        eq(taskSuggestions.organizationId, orgId),
        eq(taskSuggestions.status, status),
      ),
    )
    .orderBy(desc(taskSuggestions.createdAt));
}

export async function handleListTaskSuggestions(
  request: Request,
  auth: AuthContext,
  deps: ListDeps = {},
) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const querySuggestions = deps.querySuggestions ?? defaultQuerySuggestions;
  const rows = await querySuggestions({ orgId: auth.orgId, status });
  return NextResponse.json({ suggestions: rows });
}
```

- [ ] **Step 3: Create list route**

Create `apps/web/src/app/api/task-suggestions/route.ts`:

```typescript
import { withPermission } from '@/lib/auth/authorize';
import { handleListTaskSuggestions } from './handler';

export const GET = withPermission('dashboard.read', async (request, _ctx, auth) =>
  handleListTaskSuggestions(request, auth),
);
```

- [ ] **Step 4: Run list tests**

```bash
cd apps/web && node --import tsx/esm --test src/app/api/task-suggestions/route.test.ts
```

Expected: 1 passing.

- [ ] **Step 5: Write accept handler tests**

Create `apps/web/src/app/api/task-suggestions/[id]/accept/route.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAcceptSuggestion } from './handler';

const authCtx = { orgId: 'org-1', userId: 'user-1', role: 'owner' as const };
const params = Promise.resolve({ id: 'sug-1' });

const fakeSuggestion = {
  id: 'sug-1',
  organizationId: 'org-1',
  propertyId: 'prop-1',
  propertyName: 'Palmera',
  reservationId: 'res-1',
  title: 'Start pool heating',
  source: 'reservation',
};

void test('accept: creates task and marks suggestion accepted', async () => {
  let taskCreated = false;
  let suggestionUpdated = false;

  const response = await handleAcceptSuggestion(
    new Request('http://localhost/api/task-suggestions/sug-1/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer tok' },
      body: JSON.stringify({}),
    }),
    { params },
    authCtx,
    {
      getSuggestion: async () => fakeSuggestion,
      createTask: async () => { taskCreated = true; return { id: 'task-1' }; },
      markAccepted: async () => { suggestionUpdated = true; },
      createReminder: async () => { throw new Error('should not be called'); },
    },
  );

  assert.equal(response.status, 200);
  assert.ok(taskCreated);
  assert.ok(suggestionUpdated);
  const body = (await response.json()) as { task: { id: string } };
  assert.equal(body.task.id, 'task-1');
});

void test('accept: task creation failure → 502, suggestion not marked accepted', async () => {
  let suggestionUpdated = false;

  const response = await handleAcceptSuggestion(
    new Request('http://localhost/api/task-suggestions/sug-1/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
    { params },
    authCtx,
    {
      getSuggestion: async () => fakeSuggestion,
      createTask: async () => { throw new Error('gateway down'); },
      markAccepted: async () => { suggestionUpdated = true; },
      createReminder: async () => ({ id: 'rem-1' }),
    },
  );

  assert.equal(response.status, 502);
  assert.equal(suggestionUpdated, false);
});

void test('accept: task succeeds but reminder fails → 200 with reminderWarning, suggestion accepted', async () => {
  let suggestionUpdated = false;

  const response = await handleAcceptSuggestion(
    new Request('http://localhost/api/task-suggestions/sug-1/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reminderChannels: ['sms'], reminderTime: '2026-03-20T13:00:00Z' }),
    }),
    { params },
    authCtx,
    {
      getSuggestion: async () => fakeSuggestion,
      createTask: async () => ({ id: 'task-1' }),
      markAccepted: async () => { suggestionUpdated = true; },
      createReminder: async () => { throw new Error('db error'); },
    },
  );

  assert.equal(response.status, 200);
  assert.ok(suggestionUpdated);
  const body = (await response.json()) as { reminderWarning: string };
  assert.ok(body.reminderWarning);
});
```

- [ ] **Step 6: Implement accept handler**

Create `apps/web/src/app/api/task-suggestions/[id]/accept/handler.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { taskSuggestions, taskReminders } from '@walt/db';
import { acceptSuggestionInputSchema } from '@walt/contracts';
import type { AuthContext } from '@walt/contracts';

type Deps = {
  getSuggestion?: (id: string, orgId: string) => Promise<Record<string, unknown> | null>;
  createTask?: (args: Record<string, unknown>) => Promise<{ id: string }>;
  markAccepted?: (id: string) => Promise<void>;
  createReminder?: (args: Record<string, unknown>) => Promise<{ id: string }>;
};

async function defaultGetSuggestion(id: string, orgId: string) {
  const { db } = await import('@/lib/db');
  const [row] = await db
    .select()
    .from(taskSuggestions)
    .where(eq(taskSuggestions.id, id))
    .limit(1);
  if (!row || row.organizationId !== orgId) return null;
  return row as Record<string, unknown>;
}

async function defaultCreateTask(args: Record<string, unknown>) {
  const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';
  const res = await fetch(`${gatewayBaseUrl}/tasks`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: (args.authorization as string) ?? '',
    },
    body: JSON.stringify(args.body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Gateway error ${res.status}`);
  return res.json() as Promise<{ id: string }>;
}

async function defaultMarkAccepted(id: string) {
  const { db } = await import('@/lib/db');
  await db
    .update(taskSuggestions)
    .set({ status: 'accepted' })
    .where(eq(taskSuggestions.id, id));
}

async function defaultCreateReminder(args: Record<string, unknown>) {
  const { db } = await import('@/lib/db');
  const [row] = await db
    .insert(taskReminders)
    .values({
      taskId: args.taskId as string,
      organizationId: args.organizationId as string,
      taskTitle: args.taskTitle as string,
      propertyName: args.propertyName as string,
      channels: args.channels as string[],
      scheduledFor: new Date(args.scheduledFor as string),
    })
    .returning();
  return row;
}

export async function handleAcceptSuggestion(
  request: Request,
  context: { params: Promise<{ id: string }> },
  auth: AuthContext,
  deps: Deps = {},
) {
  const { id } = await context.params;
  const getSuggestion = deps.getSuggestion ?? defaultGetSuggestion;
  const createTask = deps.createTask ?? defaultCreateTask;
  const markAccepted = deps.markAccepted ?? defaultMarkAccepted;
  const createReminder = deps.createReminder ?? defaultCreateReminder;

  const suggestion = await getSuggestion(id, auth.orgId);
  if (!suggestion) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: z.infer<typeof acceptSuggestionInputSchema> = {};
  try {
    body = acceptSuggestionInputSchema.parse(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let task: { id: string };
  try {
    task = await createTask({
      authorization: request.headers.get('authorization'),
      body: {
        title: suggestion.title,
        description: suggestion.description,
        priority: 'medium',
        propertyIds: [suggestion.propertyId],
        dueDate: suggestion.suggestedDueDate ?? undefined,
        source: 'ai',
        sourceReservationId: suggestion.reservationId,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create task' }, { status: 502 });
  }

  await markAccepted(id);

  if (body.reminderChannels?.length && body.reminderTime) {
    try {
      const reminder = await createReminder({
        taskId: task.id,
        organizationId: auth.orgId,
        taskTitle: suggestion.title as string,
        propertyName: suggestion.propertyName as string,
        channels: body.reminderChannels,
        scheduledFor: body.reminderTime,
      });
      return NextResponse.json({ task, reminder });
    } catch {
      return NextResponse.json({
        task,
        reminder: null,
        reminderWarning: 'Reminder could not be saved',
      });
    }
  }

  return NextResponse.json({ task, reminder: null });
}
```

- [ ] **Step 7: Create accept route**

Create `apps/web/src/app/api/task-suggestions/[id]/accept/route.ts`:

```typescript
import { withPermission } from '@/lib/auth/authorize';
import { handleAcceptSuggestion } from './handler';

export const POST = withPermission(
  'ops.write',
  async (request, context: { params: Promise<{ id: string }> }, auth) =>
    handleAcceptSuggestion(request, context, auth),
);
```

- [ ] **Step 8: Write dismiss tests**

Create `apps/web/src/app/api/task-suggestions/[id]/dismiss/route.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { handleDismissSuggestion } from './handler';

const authCtx = { orgId: 'org-1', userId: 'user-1', role: 'owner' as const };

void test('dismiss: marks suggestion dismissed for correct org', async () => {
  let dismissed: { id: string; orgId: string } | undefined;

  const response = await handleDismissSuggestion(
    new Request('http://localhost/api/task-suggestions/sug-1/dismiss', { method: 'POST' }),
    { params: Promise.resolve({ id: 'sug-1' }) },
    authCtx,
    {
      markDismissed: async (id, orgId) => {
        dismissed = { id, orgId };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(dismissed, { id: 'sug-1', orgId: 'org-1' });
  const body = (await response.json()) as { ok: boolean };
  assert.equal(body.ok, true);
});
```

- [ ] **Step 9: Implement dismiss handler + route**

Create `apps/web/src/app/api/task-suggestions/[id]/dismiss/handler.ts`:

```typescript
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { taskSuggestions } from '@walt/db';
import type { AuthContext } from '@walt/contracts';

type Deps = {
  markDismissed?: (id: string, orgId: string) => Promise<void>;
};

async function defaultMarkDismissed(id: string, orgId: string) {
  const { db } = await import('@/lib/db');
  await db
    .update(taskSuggestions)
    .set({ status: 'dismissed' })
    .where(and(eq(taskSuggestions.id, id), eq(taskSuggestions.organizationId, orgId)));
}

export async function handleDismissSuggestion(
  _request: Request,
  context: { params: Promise<{ id: string }> },
  auth: AuthContext,
  deps: Deps = {},
) {
  const { id } = await context.params;
  const markDismissed = deps.markDismissed ?? defaultMarkDismissed;
  await markDismissed(id, auth.orgId);
  return NextResponse.json({ ok: true });
}
```

Create `apps/web/src/app/api/task-suggestions/[id]/dismiss/route.ts`:

```typescript
import { withPermission } from '@/lib/auth/authorize';
import { handleDismissSuggestion } from './handler';

export const POST = withPermission(
  'ops.write',
  async (request, context: { params: Promise<{ id: string }> }, auth) =>
    handleDismissSuggestion(request, context, auth),
);
```

- [ ] **Step 10: Run all suggestion API tests**

```bash
cd apps/web && node --import tsx/esm --test \
  src/app/api/task-suggestions/route.test.ts \
  src/app/api/task-suggestions/[id]/accept/route.test.ts \
  src/app/api/task-suggestions/[id]/dismiss/route.test.ts
```

Expected: 5 passing.

- [ ] **Step 11: Typecheck**

```bash
pnpm turbo run typecheck lint --filter=@walt/web
```

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/app/api/task-suggestions/
git commit -m "feat(api): add task-suggestions list, accept, and dismiss endpoints"
```

---

## Task 5: Reminder Delivery Library

**Files:**
- Create: `apps/web/src/lib/reminders/resolve-owner-contact.ts`
- Create: `apps/web/src/lib/reminders/send-reminder.ts`
- Create: `apps/web/src/lib/reminders/send-reminder.test.ts`

- [ ] **Step 1: Install dependencies**

```bash
cd apps/web && pnpm add resend twilio
```

- [ ] **Step 2: Write tests**

Create `apps/web/src/lib/reminders/send-reminder.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { sendReminder } from './send-reminder';

const baseReminder = {
  id: 'rem-1',
  taskId: 'task-1',
  organizationId: 'org-1',
  channels: ['sms', 'email'] as ('sms' | 'email')[],
  scheduledFor: new Date('2026-03-20T13:00:00Z'),
  taskTitle: 'Start pool heating',
  propertyName: 'Palmera',
};

void test('sends sms and email when both channels configured', async () => {
  let smsSent = false;
  let emailSent = false;

  await sendReminder(baseReminder, {
    resolveContact: async () => ({ email: 'owner@example.com', phone: '+15551234567' }),
    sendSms: async () => { smsSent = true; },
    sendEmail: async () => { emailSent = true; },
  });

  assert.ok(smsSent);
  assert.ok(emailSent);
});

void test('skips sms gracefully when owner has no phone number', async () => {
  let smsSent = false;
  let emailSent = false;

  await sendReminder(baseReminder, {
    resolveContact: async () => ({ email: 'owner@example.com', phone: null }),
    sendSms: async () => { smsSent = true; },
    sendEmail: async () => { emailSent = true; },
  });

  assert.equal(smsSent, false);
  assert.ok(emailSent);
});

void test('throws if a configured channel send fails', async () => {
  await assert.rejects(
    () =>
      sendReminder({ ...baseReminder, channels: ['email'] }, {
        resolveContact: async () => ({ email: 'owner@example.com', phone: null }),
        sendSms: async () => {},
        sendEmail: async () => { throw new Error('Resend unavailable'); },
      }),
    /Resend unavailable/,
  );
});
```

- [ ] **Step 3: Run tests (expect failure)**

```bash
cd apps/web && node --import tsx/esm --test src/lib/reminders/send-reminder.test.ts 2>&1 | head -10
```

Expected: module not found.

- [ ] **Step 4: Implement `resolve-owner-contact.ts`**

```typescript
import { organizationMemberships } from '@walt/db';
import { eq, and } from 'drizzle-orm';

export type OwnerContact = {
  email: string | null;
  phone: string | null;
};

export async function resolveOwnerContact(orgId: string): Promise<OwnerContact> {
  const { db } = await import('@/lib/db');

  const [membership] = await db
    .select({ userId: organizationMemberships.userId })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, orgId),
        eq(organizationMemberships.role, 'owner'),
      ),
    )
    .limit(1);

  if (!membership) return { email: null, phone: null };

  const clerkRes = await fetch(
    `https://api.clerk.com/v1/users/${membership.userId}`,
    { headers: { authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` } },
  );

  if (!clerkRes.ok) return { email: null, phone: null };

  const user = (await clerkRes.json()) as {
    email_addresses: Array<{ id: string; email_address: string }>;
    primary_email_address_id: string;
    phone_numbers: Array<{ phone_number: string }>;
  };

  const primaryEmail = user.email_addresses.find(
    (e) => e.id === user.primary_email_address_id,
  );

  return {
    email: primaryEmail?.email_address ?? null,
    phone: user.phone_numbers[0]?.phone_number ?? null,
  };
}
```

- [ ] **Step 5: Implement `send-reminder.ts`**

```typescript
import type { OwnerContact } from './resolve-owner-contact';

type ReminderPayload = {
  id: string;
  taskId: string;
  organizationId: string;
  channels: ('sms' | 'email')[];
  scheduledFor: Date;
  taskTitle: string;
  propertyName: string;
};

type SendReminderDeps = {
  resolveContact?: (orgId: string) => Promise<OwnerContact>;
  sendSms?: (to: string, body: string) => Promise<void>;
  sendEmail?: (to: string, subject: string, text: string) => Promise<void>;
};

async function defaultSendSms(to: string, body: string) {
  const twilio = (await import('twilio')).default;
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({ from: process.env.TWILIO_FROM_NUMBER ?? '', to, body });
}

async function defaultSendEmail(to: string, subject: string, text: string) {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: 'walt@notifications.walt.ai', to, subject, text });
}

export async function sendReminder(payload: ReminderPayload, deps: SendReminderDeps = {}) {
  const { resolveOwnerContact } = await import('./resolve-owner-contact');
  const resolveContact = deps.resolveContact ?? resolveOwnerContact;
  const sendSms = deps.sendSms ?? defaultSendSms;
  const sendEmail = deps.sendEmail ?? defaultSendEmail;

  const contact = await resolveContact(payload.organizationId);

  const emailText = [
    `Hi, this is a reminder for your task at ${payload.propertyName}.`,
    '',
    `Task: ${payload.taskTitle}`,
    `Due: ${payload.scheduledFor.toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
    '',
    'View your dashboard: https://app.walt.ai/today',
  ].join('\n');

  const sends: Promise<void>[] = [];

  if (payload.channels.includes('sms')) {
    if (contact.phone) {
      sends.push(sendSms(contact.phone, `[Walt] Reminder: ${payload.taskTitle} — ${payload.propertyName}`));
    } else {
      console.warn(`[reminders] No phone for org ${payload.organizationId}, skipping SMS`);
    }
  }

  if (payload.channels.includes('email') && contact.email) {
    sends.push(sendEmail(contact.email, `Reminder: ${payload.taskTitle}`, emailText));
  }

  await Promise.all(sends);
}
```

- [ ] **Step 6: Run tests**

```bash
cd apps/web && node --import tsx/esm --test src/lib/reminders/send-reminder.test.ts
```

Expected: 3 passing.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/reminders/ apps/web/package.json
git commit -m "feat(reminders): add reminder delivery and owner contact resolution"
```

---

## Task 6: Cron Jobs

Each cron route follows the same pattern as all API routes: business logic in `handler.ts`, only the HTTP export in `route.ts`.

**Files:**
- Create: `apps/web/src/app/api/cron/daily-suggestions/handler.ts` + `handler.test.ts` + `route.ts`
- Create: `apps/web/src/app/api/cron/scan-messages/handler.ts` + `handler.test.ts` + `route.ts`
- Create: `apps/web/src/app/api/cron/send-reminders/handler.ts` + `handler.test.ts` + `route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Write daily-suggestions handler tests**

Create `apps/web/src/app/api/cron/daily-suggestions/handler.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { handleDailySuggestions } from './handler';

const makeRequest = () =>
  new Request('http://localhost/api/cron/daily-suggestions', {
    method: 'POST',
    headers: { authorization: `Bearer test-secret` },
  });

void test('inserts welcome message suggestion for arriving reservation', async () => {
  const inserted: unknown[] = [];

  const response = await handleDailySuggestions(makeRequest(), {
    cronSecret: 'test-secret',
    getOrganizations: async () => [{ organizationId: 'org-1' }],
    getPropertyIds: async () => ['prop-1'],
    getArrivingReservations: async () => [
      {
        id: 'res-1',
        propertyId: 'prop-1',
        guestFirstName: 'Alice',
        arrivalDate: new Date('2026-03-20T15:00:00Z'),
      },
    ],
    getPropertyPool: async () => false,
    getPropertyName: async () => 'Palmera',
    insertSuggestion: async (row) => { inserted.push(row); },
  });

  assert.equal(response.status, 200);
  assert.equal(inserted.length, 1);
  assert.ok((inserted[0] as { title: string }).title.includes('welcome message'));
});

void test('inserts pool heating suggestion when property has pool', async () => {
  const inserted: unknown[] = [];

  await handleDailySuggestions(makeRequest(), {
    cronSecret: 'test-secret',
    getOrganizations: async () => [{ organizationId: 'org-1' }],
    getPropertyIds: async () => ['prop-1'],
    getArrivingReservations: async () => [
      {
        id: 'res-1',
        propertyId: 'prop-1',
        guestFirstName: 'Alice',
        arrivalDate: new Date('2026-03-20T15:00:00Z'),
      },
    ],
    getPropertyPool: async () => true,
    getPropertyName: async () => 'Palmera',
    insertSuggestion: async (row) => { inserted.push(row); },
  });

  assert.equal(inserted.length, 2);
  assert.ok((inserted[1] as { title: string }).title.toLowerCase().includes('pool'));
});

void test('returns 401 with wrong secret', async () => {
  const response = await handleDailySuggestions(
    new Request('http://localhost/api/cron/daily-suggestions', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    }),
    { cronSecret: 'test-secret' },
  );
  assert.equal(response.status, 401);
});

void test('no pool suggestion when property has no pool', async () => {
  const inserted: unknown[] = [];

  await handleDailySuggestions(makeRequest(), {
    cronSecret: 'test-secret',
    getOrganizations: async () => [{ organizationId: 'org-1' }],
    getPropertyIds: async () => ['prop-1'],
    getArrivingReservations: async () => [
      {
        id: 'res-1',
        propertyId: 'prop-1',
        guestFirstName: 'Bob',
        arrivalDate: new Date('2026-03-20T15:00:00Z'),
      },
    ],
    getPropertyPool: async () => false,
    getPropertyName: async () => 'Casa Blanca',
    insertSuggestion: async (row) => { inserted.push(row); },
  });

  assert.equal(inserted.length, 1);
  assert.ok(!(inserted[0] as { title: string }).title.toLowerCase().includes('pool'));
});
```

- [ ] **Step 2: Run tests (expect failure)**

```bash
cd apps/web && node --import tsx/esm --test src/app/api/cron/daily-suggestions/handler.test.ts 2>&1 | head -10
```

- [ ] **Step 3: Implement daily-suggestions handler**

Create `apps/web/src/app/api/cron/daily-suggestions/handler.ts`:

```typescript
import { NextResponse } from 'next/server';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { reservations, properties, propertyAccess, taskSuggestions } from '@walt/db';
import { organizationMemberships } from '@walt/db';

type Deps = {
  cronSecret?: string;
  getOrganizations?: () => Promise<Array<{ organizationId: string }>>;
  getPropertyIds?: (orgId: string) => Promise<string[]>;
  getArrivingReservations?: (propertyIds: string[], today: Date, tomorrow: Date) => Promise<Array<{
    id: string;
    propertyId: string | null;
    guestFirstName: string | null;
    arrivalDate: Date | null;
  }>>;
  getPropertyPool?: (propertyId: string) => Promise<boolean>;
  getPropertyName?: (propertyId: string) => Promise<string>;
  insertSuggestion?: (row: Record<string, unknown>) => Promise<void>;
};

export async function handleDailySuggestions(request: Request, deps: Deps = {}) {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');

  const getOrganizations = deps.getOrganizations ?? (async () =>
    db.selectDistinct({ organizationId: organizationMemberships.organizationId }).from(organizationMemberships)
  );

  const getPropertyIds = deps.getPropertyIds ?? (async (orgId: string) => {
    const rows = await db
      .select({ propertyId: propertyAccess.propertyId })
      .from(propertyAccess)
      .where(eq(propertyAccess.organizationId, orgId));
    return rows.map((r) => r.propertyId);
  });

  const getArrivingReservations = deps.getArrivingReservations ?? (async (propertyIds: string[], today: Date, tomorrow: Date) => {
    if (propertyIds.length === 0) return [];
    return db
      .select()
      .from(reservations)
      .where(
        and(
          inArray(reservations.propertyId, propertyIds),
          or(
            sql`${reservations.arrivalDate}::date = ${today.toISOString().slice(0, 10)}::date`,
            sql`${reservations.arrivalDate}::date = ${tomorrow.toISOString().slice(0, 10)}::date`,
          ),
        ),
      );
  });

  const getPropertyPool = deps.getPropertyPool ?? (async (propertyId: string) => {
    const [row] = await db.select({ hasPool: properties.hasPool }).from(properties).where(eq(properties.id, propertyId)).limit(1);
    return row?.hasPool ?? false;
  });

  const getPropertyName = deps.getPropertyName ?? (async (propertyId: string) => {
    const [row] = await db.select({ name: properties.name }).from(properties).where(eq(properties.id, propertyId)).limit(1);
    return row?.name ?? propertyId;
  });

  const insertSuggestion = deps.insertSuggestion ?? (async (row: Record<string, unknown>) => {
    await db.insert(taskSuggestions).values(row as Parameters<typeof db.insert>[1] extends infer T ? T : never).onConflictDoNothing();
  });

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(today.getUTCDate() + 1);

  const orgs = await getOrganizations();
  let inserted = 0;

  for (const { organizationId } of orgs) {
    const propertyIds = await getPropertyIds(organizationId);
    if (propertyIds.length === 0) continue;

    const arriving = await getArrivingReservations(propertyIds, today, tomorrow);

    for (const reservation of arriving) {
      if (!reservation.propertyId || !reservation.arrivalDate) continue;

      const firstName = reservation.guestFirstName ?? 'Guest';
      const propertyName = await getPropertyName(reservation.propertyId);
      const arrivalDate = new Date(reservation.arrivalDate);
      const arrivalDay9am = new Date(Date.UTC(
        arrivalDate.getUTCFullYear(), arrivalDate.getUTCMonth(), arrivalDate.getUTCDate(), 9,
      ));

      const toInsert: Array<{ title: string; description: string; suggestedDueDate: Date }> = [
        {
          title: `Send welcome message to ${firstName}`,
          description: `Guest arriving ${arrivalDate.toDateString()}. Send a warm welcome before check-in.`,
          suggestedDueDate: arrivalDay9am,
        },
      ];

      if (await getPropertyPool(reservation.propertyId)) {
        const dayBefore10am = new Date(Date.UTC(
          arrivalDate.getUTCFullYear(), arrivalDate.getUTCMonth(), arrivalDate.getUTCDate() - 1, 10,
        ));
        toInsert.push({
          title: `Start pool heating before ${firstName} arrival`,
          description: `Guest arrives ${arrivalDate.toDateString()}. Start heating in advance.`,
          suggestedDueDate: dayBefore10am,
        });
      }

      for (const s of toInsert) {
        await insertSuggestion({
          id: crypto.randomUUID(),
          organizationId,
          propertyId: reservation.propertyId,
          propertyName,
          reservationId: reservation.id,
          title: s.title,
          description: s.description,
          suggestedDueDate: s.suggestedDueDate,
          source: 'reservation',
          status: 'pending',
          createdAt: new Date(),
        });
        inserted++;
      }
    }
  }

  return NextResponse.json({ ok: true, inserted });
}
```

- [ ] **Step 4: Create daily-suggestions route**

Create `apps/web/src/app/api/cron/daily-suggestions/route.ts`:

```typescript
import { handleDailySuggestions } from './handler';
export const POST = (request: Request) => handleDailySuggestions(request);
```

- [ ] **Step 5: Run daily-suggestions tests**

```bash
cd apps/web && node --import tsx/esm --test src/app/api/cron/daily-suggestions/handler.test.ts
```

Expected: 4 passing.

- [ ] **Step 6: Write scan-messages handler tests**

Create `apps/web/src/app/api/cron/scan-messages/handler.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { handleScanMessages } from './handler';

void test('scans unscanned messages and marks them scanned', async () => {
  let scannedId: string | undefined;
  let inserted = false;

  await handleScanMessages(
    new Request('http://localhost/api/cron/scan-messages', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    }),
    {
      cronSecret: 'test-secret',
      getUnscannedMessages: async () => [
        { id: 'msg-1', reservationId: 'res-1', body: 'We love the pool!', senderType: 'guest' },
      ],
      markScanned: async (id) => { scannedId = id; },
      getReservationContext: async () => ({
        reservationId: 'res-1',
        propertyId: 'prop-1',
        propertyName: 'Palmera',
        guestFirstName: 'Alice',
        arrivalDate: '2026-03-20',
        organizationId: 'org-1',
      }),
      classify: async () => ({ title: 'Start pool heating before Alice arrival', description: 'Guest mentioned pool.' }),
      insertSuggestion: async () => { inserted = true; },
    },
  );

  assert.equal(scannedId, 'msg-1');
  assert.ok(inserted);
});

void test('marks scanned even if no suggestion is generated', async () => {
  let scannedId: string | undefined;
  let inserted = false;

  await handleScanMessages(
    new Request('http://localhost/api/cron/scan-messages', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    }),
    {
      cronSecret: 'test-secret',
      getUnscannedMessages: async () => [
        { id: 'msg-2', reservationId: 'res-2', body: 'Thank you!', senderType: 'guest' },
      ],
      markScanned: async (id) => { scannedId = id; },
      getReservationContext: async () => ({
        reservationId: 'res-2',
        propertyId: 'prop-1',
        propertyName: 'Palmera',
        guestFirstName: 'Bob',
        arrivalDate: '2026-03-21',
        organizationId: 'org-1',
      }),
      classify: async () => null,
      insertSuggestion: async () => { inserted = true; },
    },
  );

  assert.equal(scannedId, 'msg-2');
  assert.equal(inserted, false);
});

void test('returns 401 with wrong secret', async () => {
  const response = await handleScanMessages(
    new Request('http://localhost/api/cron/scan-messages', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    }),
    { cronSecret: 'test-secret' },
  );
  assert.equal(response.status, 401);
});
```

- [ ] **Step 7: Implement scan-messages handler**

Create `apps/web/src/app/api/cron/scan-messages/handler.ts`:

```typescript
import { NextResponse } from 'next/server';
import { and, isNull, gt, eq } from 'drizzle-orm';
import { messages, reservations, properties, taskSuggestions, propertyAccess } from '@walt/db';
import type { SuggestedTask } from '@/lib/ai/classify-message';

type ReservationContext = {
  reservationId: string;
  propertyId: string;
  propertyName: string;
  guestFirstName: string;
  arrivalDate: string;
  organizationId: string;
};

type Deps = {
  cronSecret?: string;
  getUnscannedMessages?: () => Promise<Array<{ id: string; reservationId: string | null; body: string | null; senderType: string | null }>>;
  markScanned?: (id: string) => Promise<void>;
  getReservationContext?: (reservationId: string) => Promise<ReservationContext | null>;
  classify?: (context: { body: string; guestFirstName: string; propertyName: string; arrivalDate: string }) => Promise<SuggestedTask | null>;
  insertSuggestion?: (row: Record<string, unknown>) => Promise<void>;
};

export async function handleScanMessages(request: Request, deps: Deps = {}) {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const getUnscannedMessages = deps.getUnscannedMessages ?? (async () =>
    db.select().from(messages).where(
      and(isNull(messages.suggestionScannedAt), gt(messages.createdAt, twoHoursAgo), eq(messages.senderType, 'guest')),
    ).limit(100)
  );

  const markScanned = deps.markScanned ?? (async (id: string) => {
    await db.update(messages).set({ suggestionScannedAt: new Date() }).where(eq(messages.id, id));
  });

  const getReservationContext = deps.getReservationContext ?? (async (reservationId: string) => {
    const [res] = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1);
    if (!res?.propertyId || !res.arrivalDate) return null;
    const [prop] = await db.select({ name: properties.name }).from(properties).where(eq(properties.id, res.propertyId)).limit(1);
    const [access] = await db.select({ organizationId: propertyAccess.organizationId }).from(propertyAccess).where(eq(propertyAccess.propertyId, res.propertyId)).limit(1);
    if (!access) return null;
    return {
      reservationId,
      propertyId: res.propertyId,
      propertyName: prop?.name ?? res.propertyId,
      guestFirstName: res.guestFirstName ?? 'Guest',
      arrivalDate: res.arrivalDate.toISOString().slice(0, 10),
      organizationId: access.organizationId,
    };
  });

  const classify = deps.classify ?? (async (ctx) => {
    const { classifyMessage } = await import('@/lib/ai/classify-message');
    return classifyMessage(ctx);
  });

  const insertSuggestion = deps.insertSuggestion ?? (async (row: Record<string, unknown>) => {
    await db.insert(taskSuggestions).values(row as Parameters<typeof db.insert>[1] extends infer T ? T : never).onConflictDoNothing();
  });

  const unscanned = await getUnscannedMessages();
  let inserted = 0;

  for (const message of unscanned) {
    await markScanned(message.id);
    if (!message.reservationId) continue;

    const ctx = await getReservationContext(message.reservationId);
    if (!ctx) continue;

    const suggestion = await classify({
      body: message.body ?? '',
      guestFirstName: ctx.guestFirstName,
      propertyName: ctx.propertyName,
      arrivalDate: ctx.arrivalDate,
    });

    if (!suggestion) continue;

    await insertSuggestion({
      id: crypto.randomUUID(),
      organizationId: ctx.organizationId,
      propertyId: ctx.propertyId,
      propertyName: ctx.propertyName,
      reservationId: ctx.reservationId,
      messageId: message.id,
      title: suggestion.title,
      description: suggestion.description,
      source: 'message',
      status: 'pending',
      createdAt: new Date(),
    });
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted });
}
```

Create `apps/web/src/app/api/cron/scan-messages/route.ts`:

```typescript
import { handleScanMessages } from './handler';
export const POST = (request: Request) => handleScanMessages(request);
```

- [ ] **Step 8: Write send-reminders handler tests**

Create `apps/web/src/app/api/cron/send-reminders/handler.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { handleSendReminders } from './handler';

const makeRequest = () =>
  new Request('http://localhost/api/cron/send-reminders', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  });

void test('sends due reminders and marks sent_at', async () => {
  let sentId: string | undefined;

  const response = await handleSendReminders(makeRequest(), {
    cronSecret: 'test-secret',
    getDueReminders: async () => [
      {
        id: 'rem-1',
        taskId: 'task-1',
        organizationId: 'org-1',
        taskTitle: 'Start pool heating',
        propertyName: 'Palmera',
        channels: ['email'],
        scheduledFor: new Date(),
      },
    ],
    deliver: async () => {},
    markSent: async (id) => { sentId = id; },
  });

  assert.equal(response.status, 200);
  assert.equal(sentId, 'rem-1');
  const body = (await response.json()) as { sent: number };
  assert.equal(body.sent, 1);
});

void test('leaves sent_at null and logs when delivery fails', async () => {
  let sentId: string | undefined;

  const response = await handleSendReminders(makeRequest(), {
    cronSecret: 'test-secret',
    getDueReminders: async () => [
      {
        id: 'rem-2',
        taskId: 'task-2',
        organizationId: 'org-1',
        taskTitle: 'Send welcome message',
        propertyName: 'Casa Blanca',
        channels: ['sms'],
        scheduledFor: new Date(),
      },
    ],
    deliver: async () => { throw new Error('Twilio down'); },
    markSent: async (id) => { sentId = id; },
  });

  assert.equal(response.status, 200);
  assert.equal(sentId, undefined);
  const body = (await response.json()) as { failed: number };
  assert.equal(body.failed, 1);
});

void test('returns 401 with wrong secret', async () => {
  const response = await handleSendReminders(
    new Request('http://localhost/api/cron/send-reminders', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    }),
    { cronSecret: 'test-secret' },
  );
  assert.equal(response.status, 401);
});
```

- [ ] **Step 9: Implement send-reminders handler**

Create `apps/web/src/app/api/cron/send-reminders/handler.ts`:

```typescript
import { NextResponse } from 'next/server';
import { and, isNull, lte, eq } from 'drizzle-orm';
import { taskReminders } from '@walt/db';

type DueReminder = {
  id: string;
  taskId: string;
  organizationId: string;
  taskTitle: string;
  propertyName: string;
  channels: string[];
  scheduledFor: Date;
};

type Deps = {
  cronSecret?: string;
  getDueReminders?: () => Promise<DueReminder[]>;
  deliver?: (reminder: DueReminder) => Promise<void>;
  markSent?: (id: string) => Promise<void>;
};

export async function handleSendReminders(request: Request, deps: Deps = {}) {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');

  const getDueReminders = deps.getDueReminders ?? (async () =>
    db.select().from(taskReminders).where(
      and(lte(taskReminders.scheduledFor, new Date()), isNull(taskReminders.sentAt)),
    ) as Promise<DueReminder[]>
  );

  const deliver = deps.deliver ?? (async (reminder: DueReminder) => {
    const { sendReminder } = await import('@/lib/reminders/send-reminder');
    await sendReminder({
      id: reminder.id,
      taskId: reminder.taskId,
      organizationId: reminder.organizationId,
      channels: reminder.channels as ('sms' | 'email')[],
      scheduledFor: reminder.scheduledFor,
      taskTitle: reminder.taskTitle,
      propertyName: reminder.propertyName,
    });
  });

  const markSent = deps.markSent ?? (async (id: string) => {
    await db.update(taskReminders).set({ sentAt: new Date() }).where(eq(taskReminders.id, id));
  });

  const due = await getDueReminders();
  let sent = 0;
  let failed = 0;

  for (const reminder of due) {
    try {
      await deliver(reminder);
      await markSent(reminder.id);
      sent++;
    } catch (err) {
      console.error(`[reminders] Failed to deliver ${reminder.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}
```

Create `apps/web/src/app/api/cron/send-reminders/route.ts`:

```typescript
import { handleSendReminders } from './handler';
export const POST = (request: Request) => handleSendReminders(request);
```

- [ ] **Step 10: Run all cron tests**

```bash
cd apps/web && node --import tsx/esm --test \
  src/app/api/cron/daily-suggestions/handler.test.ts \
  src/app/api/cron/scan-messages/handler.test.ts \
  src/app/api/cron/send-reminders/handler.test.ts
```

Expected: 9 passing.

- [ ] **Step 11: Create `vercel.json`**

First check: `ls vercel.json 2>/dev/null` — if the file exists, add only the `crons` key rather than replacing the whole file.

Create at repo root:

```json
{
  "crons": [
    { "path": "/api/cron/daily-suggestions", "schedule": "0 13 * * *" },
    { "path": "/api/cron/scan-messages",     "schedule": "*/30 * * * *" },
    { "path": "/api/cron/send-reminders",    "schedule": "*/15 * * * *" }
  ]
}
```

- [ ] **Step 12: Typecheck**

```bash
pnpm turbo run typecheck lint --filter=@walt/web
```

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/app/api/cron/ vercel.json
git commit -m "feat(cron): add daily-suggestions, scan-messages, and send-reminders cron jobs"
```

---

## Task 7: `/today` Page

**Files:**
- Create: `apps/web/src/app/today/page.tsx`
- Create: `apps/web/src/app/today/SuggestionsStack.tsx`
- Create: `apps/web/src/app/today/SuggestionCard.tsx`

- [ ] **Step 1: Create the server page**

`getAuthContext()` is called without a request argument in server components — it reads from the active Next.js request context via Clerk internally.

Create `apps/web/src/app/today/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { and, eq, or, sql } from 'drizzle-orm';
import { reservations, propertyAccess, properties } from '@walt/db';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { SuggestionsStack } from './SuggestionsStack';

async function getTurnovers(orgId: string) {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select({
      id: reservations.id,
      propertyName: properties.name,
      guestFirstName: reservations.guestFirstName,
      guestLastName: reservations.guestLastName,
      arrivalDate: reservations.arrivalDate,
      departureDate: reservations.departureDate,
    })
    .from(reservations)
    .innerJoin(propertyAccess, eq(propertyAccess.propertyId, reservations.propertyId))
    .innerJoin(properties, eq(properties.id, reservations.propertyId))
    .where(
      and(
        eq(propertyAccess.organizationId, orgId),
        or(
          sql`${reservations.arrivalDate}::date = ${today}::date`,
          sql`${reservations.departureDate}::date = ${today}::date`,
        ),
      ),
    )
    .orderBy(reservations.arrivalDate);
}

async function getTasksFromGateway(orgId: string) {
  const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';
  const headers = {
    accept: 'application/json',
    // Note: confirm gateway accepts CRON_SECRET as a service token.
    // If not, replace with Clerk getToken() from @clerk/nextjs/server.
    authorization: `Bearer ${process.env.CRON_SECRET}`,
  };

  const [dueRes, urgentRes] = await Promise.allSettled([
    fetch(`${gatewayBaseUrl}/tasks?organization_id=${orgId}&due_date=today`, { headers, cache: 'no-store' }),
    fetch(`${gatewayBaseUrl}/tasks?organization_id=${orgId}&priority=high&status=open`, { headers, cache: 'no-store' }),
  ]);

  const tasks: unknown[] = [];
  if (dueRes.status === 'fulfilled' && dueRes.value.ok) {
    const body = (await dueRes.value.json()) as { tasks?: unknown[] };
    tasks.push(...(body.tasks ?? []));
  }
  if (urgentRes.status === 'fulfilled' && urgentRes.value.ok) {
    const body = (await urgentRes.value.json()) as { tasks?: unknown[] };
    tasks.push(...(body.tasks ?? []));
  }
  // Deduplicate by id
  const seen = new Set<string>();
  return tasks.filter((t) => {
    const id = (t as { id: string }).id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export default async function TodayPage() {
  const auth = await getAuthContext();
  if (!auth) redirect('/sign-in');

  const [turnovers, tasks] = await Promise.all([
    getTurnovers(auth.orgId),
    getTasksFromGateway(auth.orgId),
  ]);

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Today &middot; {dateLabel}</h1>

      <SuggestionsStack />

      <div className="flex gap-3">
        <a href="#turnovers" className="flex-1 rounded-lg bg-yellow-50 p-3 text-center">
          <div className="text-2xl font-bold text-yellow-700">{turnovers.length}</div>
          <div className="text-xs text-yellow-600">Turnovers</div>
        </a>
        <a href="#tasks" className="flex-1 rounded-lg bg-blue-50 p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{tasks.length}</div>
          <div className="text-xs text-blue-600">Tasks Due</div>
        </a>
      </div>

      <section id="turnovers">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Turnovers Today
        </h2>
        {turnovers.length === 0 ? (
          <p className="text-sm text-gray-400">No turnovers today.</p>
        ) : (
          <div className="space-y-2">
            {turnovers.map((t) => (
              <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{t.propertyName}</span>
                  <span className="text-xs bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5">
                    {t.arrivalDate && t.departureDate ? 'Turnover' : t.arrivalDate ? 'Check-in' : 'Check-out'}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {t.guestFirstName} {t.guestLastName}
                  {t.departureDate && ` · Out ${new Date(t.departureDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}`}
                  {t.arrivalDate && ` · In ${new Date(t.arrivalDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="tasks">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Tasks Due Today
        </h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks due today.</p>
        ) : (
          <div className="space-y-2">
            {(tasks as Array<{ id: string; title: string; priority: string }>).map((task) => (
              <div key={task.id} className="rounded-lg border border-gray-200 bg-white p-4 flex items-start gap-3">
                <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${task.priority === 'high' ? 'bg-red-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-900">{task.title}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create `SuggestionCard.tsx`**

Create `apps/web/src/app/today/SuggestionCard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { TaskSuggestion } from '@walt/contracts';

type Props = {
  suggestion: TaskSuggestion;
  onAccepted: (id: string) => void;
  onDismissed: (id: string) => void;
};

export function SuggestionCard({ suggestion, onAccepted, onDismissed }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(suggestion.title);
  const [dueDate, setDueDate] = useState(
    suggestion.suggestedDueDate ? suggestion.suggestedDueDate.slice(0, 16) : '',
  );
  const [smsChecked, setSmsChecked] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/task-suggestions/${suggestion.id}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reminderChannels: [
            ...(smsChecked ? (['sms'] as const) : []),
            ...(emailChecked ? (['email'] as const) : []),
          ],
          reminderTime: dueDate ? new Date(dueDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      onAccepted(suggestion.id);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDismiss() {
    await fetch(`/api/task-suggestions/${suggestion.id}/dismiss`, { method: 'POST' });
    onDismissed(suggestion.id);
  }

  return (
    <div className="rounded-lg bg-white border border-yellow-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-yellow-700 mb-1">{suggestion.propertyName}</div>
          <div className="text-sm font-medium text-gray-900">{suggestion.title}</div>
          {suggestion.description && (
            <div className="text-xs text-gray-500 mt-0.5">{suggestion.description}</div>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 text-sm shrink-0"
        >
          Skip
        </button>
      </div>

      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="mt-3 w-full rounded-md bg-gray-900 text-white py-2 text-sm font-medium"
        >
          Add task
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
          />
          <input
            type="datetime-local"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={smsChecked} onChange={(e) => setSmsChecked(e.target.checked)} />
              SMS reminder
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={emailChecked} onChange={(e) => setEmailChecked(e.target.checked)} />
              Email reminder
            </label>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleAccept}
            disabled={loading}
            className="w-full rounded-md bg-gray-900 text-white py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `SuggestionsStack.tsx`**

Create `apps/web/src/app/today/SuggestionsStack.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TaskSuggestion } from '@walt/contracts';
import { SuggestionCard } from './SuggestionCard';

export function SuggestionsStack() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchSuggestions() {
    try {
      const res = await fetch('/api/task-suggestions?status=pending');
      if (res.ok) {
        const body = (await res.json()) as { suggestions: TaskSuggestion[] };
        setSuggestions(body.suggestions);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchSuggestions();

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        router.refresh(); // re-run server component (turnovers + tasks)
        void fetchSuggestions(); // re-fetch client suggestions
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [router]);

  if (loading || suggestions.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-yellow-700 mb-3">
        {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}
      </h2>
      <div className="space-y-3">
        {suggestions.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            onAccepted={(id) => setSuggestions((prev) => prev.filter((x) => x.id !== id))}
            onDismissed={(id) => setSuggestions((prev) => prev.filter((x) => x.id !== id))}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm turbo run typecheck lint --filter=@walt/web
```

Expected: no errors. Fix any that appear before continuing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/today/
git commit -m "feat(web): add /today daily operations dashboard page"
```

---

## Task 8: Navigation + Root Redirect

**Files:**
- Modify: `apps/web/src/lib/nav-links.ts`
- Modify: `apps/web/src/lib/nav-links.test.ts`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Add Today ordering test**

Open `apps/web/src/lib/nav-links.test.ts`. Add a test asserting Today is the first nav item:

```typescript
void test('Today is the first nav item', () => {
  assert.equal(navLinks[0]?.href, '/today');
  assert.equal(navLinks[0]?.label, 'Today');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && node --import tsx/esm --test src/lib/nav-links.test.ts 2>&1 | tail -10
```

Expected: Today test fails.

- [ ] **Step 3: Add Today to nav**

In `apps/web/src/lib/nav-links.ts`, prepend `{ href: '/today', label: 'Today' }`:

```typescript
export const navLinks: readonly NavLink[] = [
  { href: '/today', label: 'Today' },
  { href: '/inbox', label: 'Inbox' },
  // ... rest unchanged
```

- [ ] **Step 4: Update root redirect**

In `apps/web/src/app/page.tsx`:

```typescript
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/today');
}
```

- [ ] **Step 5: Run nav tests**

```bash
cd apps/web && node --import tsx/esm --test src/lib/nav-links.test.ts
```

Expected: all pass.

- [ ] **Step 6: Full check**

```bash
pnpm turbo run typecheck lint build --filter=@walt/web
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/nav-links.ts apps/web/src/lib/nav-links.test.ts apps/web/src/app/page.tsx
git commit -m "feat(web): set /today as default landing page and first nav item"
```

---

## Task 9: End-to-End Smoke Test

Manual verification before raising the PR.

- [ ] **Start the dev server**

```bash
pnpm dev --filter=@walt/web
```

- [ ] **Check `/today` loads** — open http://localhost:3000/today. Should show header, empty suggestions section (none pending), turnovers, tasks.

- [ ] **Check root redirect** — http://localhost:3000 should redirect to `/today`.

- [ ] **Check "Today" appears first in the sidebar nav.**

- [ ] **Test cron auth** — `curl -X POST http://localhost:3000/api/cron/daily-suggestions` (no auth header). Should return 401.

- [ ] **Manually insert a test suggestion** in the DB and verify it appears and can be accepted/dismissed.

- [ ] **Full pre-PR check**

```bash
pnpm turbo run typecheck lint build --filter=@walt/web
```

Expected: all pass.

- [ ] **Raise PR using `creating-post-merge-prs` skill** before pushing.

---

## Env Vars Checklist

| Variable | Purpose | Status |
|---|---|---|
| `RESEND_API_KEY` | Email delivery | New — add to Vercel |
| `CRON_SECRET` | Vercel cron auth + server-to-gateway calls | New — add to Vercel |
| `CLERK_SECRET_KEY` | Owner contact lookup via Clerk API | Already set |
| `TWILIO_ACCOUNT_SID` | SMS delivery | Already set |
| `TWILIO_AUTH_TOKEN` | SMS delivery | Already set |
| `TWILIO_FROM_NUMBER` | SMS sender number | Already set |
| `GATEWAY_BASE_URL` | Task gateway | Already set |

**Pre-implementation gate:** Confirm with the gateway owner that `Authorization: Bearer <CRON_SECRET>` is accepted on task endpoints. If not, replace the server-side task fetch in `today/page.tsx` with a Clerk `getToken()` call.
