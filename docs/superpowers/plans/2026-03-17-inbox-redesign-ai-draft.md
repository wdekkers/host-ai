# Inbox Redesign + AI Draft + Learning Memory Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-column inbox with a two-column layout featuring real-time AI draft generation, hint-based regeneration, and automatic learning detection that builds per-property memory.

**Architecture:** Client-rendered two-column inbox (`/inbox`) fetches from a new `GET /api/inbox` endpoint. The right column embeds a new `AiDraftPanel` component that calls the extended `/suggest` and new `/send` endpoints. After sending with hints, a `LearningToast` fires a background detect call and offers to save property facts to the new `property_memory` table. Three new DB tables (`guidebook_entries`, `property_memory`, `agent_configs`) are added in a single migration.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM + PostgreSQL, OpenAI GPT-4o-mini, Tailwind CSS, Clerk auth (`withPermission`), React hooks

---

## Chunk 1: DB Schema + Migration

### Task 1: Add three new tables to Drizzle schema

**Files:**

- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add guidebook_entries, property_memory, and agent_configs tables**

Open `packages/db/src/schema.ts` and append after the `auditEvents` table:

```typescript
export const guidebookEntries = waltSchema.table(
  'guidebook_entries',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    propertyId: text('property_id').notNull(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    mediaUrl: text('media_url'),
    aiUseCount: integer('ai_use_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    orgIdx: index('guidebook_entries_organization_id_idx').on(table.organizationId),
    propIdx: index('guidebook_entries_property_id_idx').on(table.propertyId),
  }),
);

// NOTE: property_memory intentionally has NO updatedAt — facts are immutable by design.
// Editing a fact before saving creates a new row; existing rows are never updated.
export const propertyMemory = waltSchema.table(
  'property_memory',
  {
    id: uuid('id').primaryKey(), // supply via uuidv4() at application layer — no defaultRandom()
    organizationId: text('organization_id').notNull(),
    propertyId: text('property_id').notNull(),
    fact: text('fact').notNull(),
    source: text('source').notNull(), // 'learned' | 'manual'
    sourceReservationId: text('source_reservation_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    orgIdx: index('property_memory_organization_id_idx').on(table.organizationId),
    propIdx: index('property_memory_property_id_idx').on(table.propertyId),
  }),
);

export const agentConfigs = waltSchema.table(
  'agent_configs',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    scope: text('scope').notNull(), // 'global' | 'property'
    propertyId: text('property_id'), // null for global scope
    tone: text('tone'),
    emojiUse: text('emoji_use'),
    responseLength: text('response_length'),
    escalationRules: text('escalation_rules'),
    specialInstructions: text('special_instructions'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    orgIdx: index('agent_configs_organization_id_idx').on(table.organizationId),
  }),
);
```

- [ ] **Step 2: Export new tables from the package**

Check `packages/db/src/index.ts` (or wherever exports live) and add:

```typescript
export { guidebookEntries, propertyMemory, agentConfigs } from './schema';
```

Run: `grep -n "export" packages/db/src/index.ts | head -5` to confirm existing export pattern first, then match it.

- [ ] **Step 3: Generate the Drizzle migration**

```bash
pnpm --filter @walt/db db:generate
```

Expected: a new file `packages/db/drizzle/0008_*.sql` is created and `meta/_journal.json` is updated with idx 8.

- [ ] **Step 4: Inspect and patch the generated SQL for partial unique indexes**

Drizzle does not generate partial unique indexes natively. Open the generated `0008_*.sql` and append these two statements at the end:

```sql
CREATE UNIQUE INDEX "agent_configs_global_unique_idx"
  ON "walt"."agent_configs" ("organization_id")
  WHERE "scope" = 'global';

CREATE UNIQUE INDEX "agent_configs_property_unique_idx"
  ON "walt"."agent_configs" ("organization_id", "property_id")
  WHERE "scope" = 'property';
```

**Note:** These indexes are appended manually outside of Drizzle's awareness. Drizzle's snapshot file (`meta/0008_snapshot.json`) will not include them. Future `db:generate` runs may flag schema drift for these indexes — this is expected and the drift entries can be ignored (or suppressed with a custom migration). Do not attempt to re-generate the migration to fix this warning.

- [ ] **Step 5: Test migration against a fresh local Postgres**

```bash
DATABASE_URL=postgres://walt:walt@localhost:5432/walt_test pnpm --filter @walt/db db:migrate
```

Expected: exits 0, all three tables exist.

- [ ] **Step 6: Build the db package so types are available**

```bash
pnpm --filter @walt/db build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/index.ts packages/db/drizzle/
git commit -m "feat(db): add guidebook_entries, property_memory, agent_configs tables"
```

---

## Chunk 2: API Layer

### Task 2: New `GET /api/inbox` endpoint

**Files:**

- Create: `apps/web/src/app/api/inbox/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { desc, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { messages, reservations } from '@walt/db';

const PAGE_SIZE = 25;

// NOTE: `reservations` and `messages` tables do not have an organizationId column (pre-existing
// schema limitation). Auth is enforced at the Clerk session level — only authenticated users
// with a valid org token can reach this route. This is consistent with all other inbox routes.
// org-level data isolation in the DB is a future improvement.
export const GET = withPermission('dashboard.read', async (request: Request) => {
  const url = new URL(request.url);
  const filter = url.searchParams.get('filter') ?? 'all'; // 'all' | 'unreplied' | 'ai_ready'
  const search = url.searchParams.get('search') ?? '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const perPage = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get('per_page') ?? String(PAGE_SIZE), 10)),
  );
  const offset = (page - 1) * perPage;

  // Get all reservationIds ordered by most recent message, with per-thread stats
  const threadStats = await db
    .select({
      reservationId: messages.reservationId,
      lastMessageAt: sql<string>`max(${messages.createdAt})`.as('last_message_at'),
      lastBody:
        sql<string>`(array_agg(${messages.body} order by ${messages.createdAt} desc))[1]`.as(
          'last_body',
        ),
      lastSenderType:
        sql<string>`(array_agg(${messages.senderType} order by ${messages.createdAt} desc))[1]`.as(
          'last_sender_type',
        ),
      hasSuggestion:
        sql<boolean>`bool_or(${messages.suggestion} is not null and ${messages.senderType} = 'guest')`.as(
          'has_suggestion',
        ),
    })
    .from(messages)
    .groupBy(messages.reservationId)
    .orderBy(desc(sql`max(${messages.createdAt})`));

  // Join with reservations for guest name / property name / search
  const reservationRows = await db
    .select({
      id: reservations.id,
      guestFirstName: reservations.guestFirstName,
      guestLastName: reservations.guestLastName,
      propertyId: reservations.propertyId,
      propertyName: reservations.propertyName,
      checkIn: reservations.checkIn,
      checkOut: reservations.checkOut,
      platform: reservations.platform,
    })
    .from(reservations)
    .where(
      inArray(
        reservations.id,
        threadStats.map((t) => t.reservationId),
      ),
    );

  const reservationMap = new Map(reservationRows.map((r) => [r.id, r]));

  // Determine unreplied: fetch most recent message per reservation
  const mostRecentMessages = await db
    .select({
      reservationId: messages.reservationId,
      senderType: messages.senderType,
      suggestion: messages.suggestion,
      id: messages.id,
    })
    .from(messages)
    .where(
      inArray(
        messages.reservationId,
        threadStats.map((t) => t.reservationId),
      ),
    )
    .orderBy(desc(messages.createdAt));

  const latestByReservation = new Map<
    string,
    { senderType: string; suggestion: string | null; id: string }
  >();
  for (const m of mostRecentMessages) {
    if (!latestByReservation.has(m.reservationId)) {
      latestByReservation.set(m.reservationId, {
        senderType: m.senderType,
        suggestion: m.suggestion,
        id: m.id,
      });
    }
  }

  // Build thread list
  let threads = threadStats.map((t) => {
    const res = reservationMap.get(t.reservationId);
    const latest = latestByReservation.get(t.reservationId);
    const unreplied = latest?.senderType === 'guest';
    const aiReady = unreplied && latest?.suggestion != null;
    const guestName =
      [res?.guestFirstName, res?.guestLastName].filter(Boolean).join(' ') || 'Guest';
    return {
      reservationId: t.reservationId,
      guestName,
      propertyId: res?.propertyId ?? null,
      propertyName: res?.propertyName ?? null,
      checkIn: res?.checkIn ?? null,
      checkOut: res?.checkOut ?? null,
      platform: res?.platform ?? null,
      lastBody: t.lastBody,
      lastSenderType: t.lastSenderType,
      lastMessageAt: t.lastMessageAt,
      unreplied,
      aiReady,
      latestMessageId: latest?.id ?? null,
      latestSuggestion: latest?.suggestion ?? null,
    };
  });

  // Filter
  if (filter === 'unreplied') threads = threads.filter((t) => t.unreplied);
  if (filter === 'ai_ready') threads = threads.filter((t) => t.aiReady);

  // Search
  if (search) {
    const q = search.toLowerCase();
    threads = threads.filter(
      (t) =>
        t.guestName.toLowerCase().includes(q) || (t.propertyName ?? '').toLowerCase().includes(q),
    );
  }

  const total = threads.length;
  const paged = threads.slice(offset, offset + perPage);

  return NextResponse.json({ threads: paged, total, page, perPage });
});
```

- [ ] **Step 2: Manual smoke test**

```bash
# Start dev server, then:
curl -s "http://localhost:3000/api/inbox?filter=all" -H "Authorization: Bearer <token>" | python3 -m json.tool | head -40
```

Expected: JSON with `threads` array and `total` count.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/inbox/route.ts
git commit -m "feat(api): add GET /api/inbox endpoint with filter/search/pagination"
```

---

### Task 3: Extend `POST /api/inbox/[reservationId]/suggest` with chips + extraContext

**Files:**

- Modify: `apps/web/src/app/api/inbox/[reservationId]/suggest/route.ts`
- Modify: `apps/web/src/lib/generate-reply-suggestion.ts`

- [ ] **Step 1: Update `generate-reply-suggestion.ts` to query guidebook + memory + agent config and accept hints**

Replace the entire file:

```typescript
import OpenAI from 'openai';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { propertyFaqs, guidebookEntries, propertyMemory, agentConfigs } from '@walt/db';
import { db } from '@/lib/db';

const CHIP_INSTRUCTIONS: Record<string, string> = {
  shorter: 'Keep the reply to 1-2 sentences maximum.',
  no_emoji: 'Do not use any emoji.',
  formal: 'Use a formal, professional tone.',
  friendly: 'Use a warm, very friendly and casual tone.',
  more_detail: 'Provide more detail and explanation in the reply.',
};

export async function generateReplySuggestion({
  guestName,
  propertyName,
  propertyId,
  organizationId,
  checkIn,
  checkOut,
  messageBody,
  chips,
  extraContext,
}: {
  guestName: string;
  propertyName: string;
  propertyId: string | null;
  organizationId: string;
  checkIn: Date | string | null;
  checkOut: Date | string | null;
  messageBody: string;
  chips?: string[];
  extraContext?: string;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const formatDate = (d: Date | string | null) =>
    d ? new Date(d).toLocaleDateString() : 'unknown';

  // --- Knowledge: FAQ ---
  let faqContext = '';
  if (propertyId) {
    const faqs = await db
      .select({ category: propertyFaqs.category, answer: propertyFaqs.answer })
      .from(propertyFaqs)
      .where(eq(propertyFaqs.propertyId, propertyId));
    const faqLines = faqs
      .filter((f) => f.answer)
      .map((f) => `Q: ${f.category}\nA: ${f.answer}`)
      .join('\n\n');
    if (faqLines) faqContext = `\n\nFAQ:\n${faqLines}`;
  }

  // --- Knowledge: Guidebook (keyword match) ---
  let guidebookContext = '';
  if (propertyId) {
    const words = messageBody
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);
    if (words.length > 0) {
      const conditions = words.map((w) =>
        or(ilike(guidebookEntries.title, `%${w}%`), ilike(guidebookEntries.description, `%${w}%`)),
      );
      const entries = await db
        .select({
          title: guidebookEntries.title,
          description: guidebookEntries.description,
          mediaUrl: guidebookEntries.mediaUrl,
          id: guidebookEntries.id,
        })
        .from(guidebookEntries)
        .where(and(eq(guidebookEntries.propertyId, propertyId), or(...conditions)))
        .limit(3);

      if (entries.length > 0) {
        const lines = entries
          .map(
            (e) =>
              `[${e.title}]: ${e.description}${e.mediaUrl ? ` (Video/link: ${e.mediaUrl})` : ''}`,
          )
          .join('\n\n');
        guidebookContext = `\n\nGuidebook entries for this property:\n${lines}`;

        // Increment ai_use_count for matched entries
        await Promise.all(
          entries.map((e) =>
            db
              .update(guidebookEntries)
              .set({ aiUseCount: sql`${guidebookEntries.aiUseCount} + 1`, lastUsedAt: new Date() })
              .where(eq(guidebookEntries.id, e.id)),
          ),
        );
      }
    }
  }

  // --- Knowledge: Learned Memory ---
  let memoryContext = '';
  if (propertyId) {
    const facts = await db
      .select({ fact: propertyMemory.fact })
      .from(propertyMemory)
      .where(eq(propertyMemory.propertyId, propertyId))
      .limit(20);
    if (facts.length > 0) {
      memoryContext = `\n\nProperty facts (learned):\n${facts.map((f) => `- ${f.fact}`).join('\n')}`;
    }
  }

  // --- Agent Config: global then property override ---
  let tone = 'warm and friendly';
  let emojiUse = 'light (1-2 emoji max)';
  let responseLength = 'balanced (2-3 sentences)';
  let specialInstructions = '';

  const globalConfig = await db
    .select()
    .from(agentConfigs)
    .where(and(eq(agentConfigs.organizationId, organizationId), eq(agentConfigs.scope, 'global')))
    .limit(1);

  if (globalConfig[0]) {
    if (globalConfig[0].tone) tone = globalConfig[0].tone;
    if (globalConfig[0].emojiUse) emojiUse = globalConfig[0].emojiUse;
    if (globalConfig[0].responseLength) responseLength = globalConfig[0].responseLength;
    if (globalConfig[0].specialInstructions)
      specialInstructions = globalConfig[0].specialInstructions;
  }

  if (propertyId) {
    const propConfig = await db
      .select()
      .from(agentConfigs)
      .where(
        and(
          eq(agentConfigs.organizationId, organizationId),
          eq(agentConfigs.scope, 'property'),
          eq(agentConfigs.propertyId, propertyId),
        ),
      )
      .limit(1);

    if (propConfig[0]) {
      if (propConfig[0].tone) tone = propConfig[0].tone;
      if (propConfig[0].emojiUse) emojiUse = propConfig[0].emojiUse;
      if (propConfig[0].responseLength) responseLength = propConfig[0].responseLength;
      if (propConfig[0].specialInstructions)
        specialInstructions = propConfig[0].specialInstructions;
    }
  }

  // --- Chips → style instructions ---
  const chipLines = (chips ?? [])
    .map((c) => CHIP_INSTRUCTIONS[c])
    .filter(Boolean)
    .join('\n');

  // --- Extra context ---
  const extraLine = extraContext ? `\nExtra context for this reply: ${extraContext}` : '';

  const systemPrompt = `You are a short-term rental host assistant drafting a reply to a guest.

Property: ${propertyName}
Guest: ${guestName}
Check-in: ${formatDate(checkIn)}
Check-out: ${formatDate(checkOut)}

Tone: ${tone}
Emoji use: ${emojiUse}
Length: ${responseLength}
${specialInstructions ? `Special instructions: ${specialInstructions}` : ''}
${chipLines ? `Style modifiers for this reply:\n${chipLines}` : ''}${extraLine}

Reply in the same language as the guest message. Do not start with "Of course" or "Certainly".${faqContext}${guidebookContext}${memoryContext}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: messageBody },
    ],
  });

  return response.choices[0]?.message?.content ?? null;
}
```

- [ ] **Step 2: Update the suggest route to accept chips + extraContext and pass organizationId**

Replace `apps/web/src/app/api/inbox/[reservationId]/suggest/route.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { generateReplySuggestion } from '@/lib/generate-reply-suggestion';
import { handleApiError } from '@/lib/secure-logger';
import { messages, reservations } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const POST = withPermission(
  'dashboard.read',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { reservationId } = await params;
      const body = (await request.json()) as {
        messageId: string;
        chips?: string[];
        extraContext?: string;
      };
      const { messageId, chips, extraContext } = body;

      const [reservation] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId));

      if (!reservation) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }

      const [message] = await db.select().from(messages).where(eq(messages.id, messageId));

      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      const guestName =
        [reservation.guestFirstName, reservation.guestLastName].filter(Boolean).join(' ') ||
        'the guest';

      const organizationId = authContext.orgId;

      const suggestion = await generateReplySuggestion({
        guestName,
        propertyName: reservation.propertyName ?? 'the property',
        propertyId: reservation.propertyId ?? null,
        organizationId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        messageBody: message.body,
        chips,
        extraContext,
      });

      if (!suggestion) {
        return NextResponse.json({ error: 'Could not generate suggestion' }, { status: 503 });
      }

      await db
        .update(messages)
        .set({ suggestion, suggestionGeneratedAt: new Date() })
        .where(eq(messages.id, messageId));

      return NextResponse.json({ suggestion });
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/suggest' });
    }
  },
);
```

**Note:** `authContext.orgId` is confirmed as the correct field — see the Auth context pattern note in the Notes section at the bottom of this plan.

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm --filter @walt/web typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/inbox/\[reservationId\]/suggest/route.ts apps/web/src/lib/generate-reply-suggestion.ts
git commit -m "feat(api): extend suggest with chips/extraContext; add guidebook+memory+agentConfig to generation"
```

---

### Task 4: New `POST /api/inbox/[reservationId]/send`

**Files:**

- Create: `apps/web/src/app/api/inbox/[reservationId]/send/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { reservations, messages } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const POST = withPermission(
  'dashboard.read',
  async (request: Request, { params }: Params) => {
    try {
      const { reservationId } = await params;
      const { suggestion } = (await request.json()) as { suggestion: string };

      if (!suggestion?.trim()) {
        return NextResponse.json({ error: 'suggestion is required' }, { status: 400 });
      }

      const [reservation] = await db
        .select({ id: reservations.id })
        .from(reservations)
        .where(eq(reservations.id, reservationId));

      if (!reservation) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }

      await db.insert(messages).values({
        id: uuidv4(),
        reservationId,
        platform: null,
        body: suggestion.trim(),
        senderType: 'host',
        senderFullName: null,
        createdAt: new Date(),
        suggestion: null,
        suggestionGeneratedAt: null,
        raw: {},
      });

      return NextResponse.json({ ok: true, body: suggestion.trim() });
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/send' });
    }
  },
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/inbox/\[reservationId\]/send/route.ts
git commit -m "feat(api): add POST /api/inbox/[reservationId]/send (v1 clipboard)"
```

---

### Task 5: Memory API endpoints

**Files:**

- Create: `apps/web/src/app/api/properties/[id]/memory/route.ts`
- Create: `apps/web/src/app/api/properties/[id]/memory/[factId]/route.ts`
- Create: `apps/web/src/app/api/properties/[id]/memory/detect/route.ts`

- [ ] **Step 1: Create `route.ts` (list + create)**

```typescript
// apps/web/src/app/api/properties/[id]/memory/route.ts
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { propertyMemory } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

export const GET = withPermission(
  'dashboard.read',
  async (_req: Request, { params }: Params, authContext) => {
    try {
      const { id: propertyId } = await params;
      const organizationId = authContext.orgId;

      const facts = await db
        .select()
        .from(propertyMemory)
        .where(
          and(
            eq(propertyMemory.organizationId, organizationId),
            eq(propertyMemory.propertyId, propertyId),
          ),
        )
        .orderBy(desc(propertyMemory.createdAt));

      return NextResponse.json({ facts });
    } catch (error) {
      return handleApiError({ error, route: '/api/properties/[id]/memory GET' });
    }
  },
);

export const POST = withPermission(
  'dashboard.read',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { id: propertyId } = await params;
      const organizationId = authContext.orgId;
      const { fact, source, sourceReservationId } = (await request.json()) as {
        fact: string;
        source?: string;
        sourceReservationId?: string;
      };

      if (!fact?.trim()) {
        return NextResponse.json({ error: 'fact is required' }, { status: 400 });
      }

      const [created] = await db
        .insert(propertyMemory)
        .values({
          id: uuidv4(),
          organizationId,
          propertyId,
          fact: fact.trim(),
          source: source ?? 'manual',
          sourceReservationId: sourceReservationId ?? null,
          createdAt: new Date(),
        })
        .returning();

      return NextResponse.json({ fact: created }, { status: 201 });
    } catch (error) {
      return handleApiError({ error, route: '/api/properties/[id]/memory POST' });
    }
  },
);
```

- [ ] **Step 2: Create `[factId]/route.ts` (delete)**

```typescript
// apps/web/src/app/api/properties/[id]/memory/[factId]/route.ts
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { propertyMemory } from '@walt/db';

type Params = { params: Promise<{ id: string; factId: string }> };

export const DELETE = withPermission(
  'dashboard.read',
  async (_req: Request, { params }: Params, authContext) => {
    try {
      const { id: propertyId, factId } = await params;
      const organizationId = authContext.orgId;

      await db
        .delete(propertyMemory)
        .where(
          and(
            eq(propertyMemory.id, factId),
            eq(propertyMemory.propertyId, propertyId),
            eq(propertyMemory.organizationId, organizationId),
          ),
        );

      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleApiError({ error, route: '/api/properties/[id]/memory/[factId] DELETE' });
    }
  },
);
```

- [ ] **Step 3: Create `detect/route.ts` (classify hints)**

```typescript
// apps/web/src/app/api/properties/[id]/memory/detect/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

import { withPermission } from '@/lib/auth/authorize';
import { handleApiError } from '@/lib/secure-logger';

type Fact = { text: string; type: 'property_fact' | 'situational' };

type Params = { params: Promise<{ id: string }> };

export const POST = withPermission(
  'dashboard.read',
  async (request: Request, { params: _params }: Params) => {
    try {
      const { hintText, chips } = (await request.json()) as {
        hintText?: string;
        chips: string[];
        reservationId: string;
      };

      // Chips alone contain no learnable facts — skip LLM call
      if (!hintText?.trim()) {
        return NextResponse.json({ facts: [] });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return NextResponse.json({ facts: [] });

      const client = new OpenAI({ apiKey });

      const prompt = `You are classifying host hints about a vacation rental property.

Given the following hint text provided by a host when sending a message to a guest, extract individual facts and classify each as:
- "property_fact": a standing truth about the property that would be useful in future replies (e.g. "pool takes 24-48 hours to heat", "parking is in the garage")
- "situational": context specific only to this moment that should not be remembered (e.g. "it's warm today", "the guest mentioned it earlier")

Hint text: "${hintText.trim()}"

Return a JSON object with this exact shape: { "facts": [{ "text": "...", "type": "property_fact" | "situational" }] }
Return only the JSON object, no other text.`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content ?? '{"facts":[]}';
      let facts: Fact[] = [];
      try {
        const parsed = JSON.parse(raw) as { facts?: Fact[] } | Fact[];
        facts = Array.isArray(parsed) ? parsed : (parsed.facts ?? []);
      } catch {
        facts = [];
      }

      return NextResponse.json({ facts });
    } catch (error) {
      return handleApiError({ error, route: '/api/properties/[id]/memory/detect' });
    }
  },
);
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @walt/web typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/properties/
git commit -m "feat(api): add property memory CRUD + learning detect endpoints"
```

---

### Task 6: Agent Config API endpoints

**Files:**

- Create: `apps/web/src/app/api/agent-config/route.ts`
- Create: `apps/web/src/app/api/properties/[id]/agent-config/route.ts`

- [ ] **Step 1: Create global agent config route**

```typescript
// apps/web/src/app/api/agent-config/route.ts
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { agentConfigs } from '@walt/db';

export const GET = withPermission('dashboard.read', async (_req: Request, _p, authContext) => {
  try {
    const organizationId = authContext.orgId;
    const [config] = await db
      .select()
      .from(agentConfigs)
      .where(and(eq(agentConfigs.organizationId, organizationId), eq(agentConfigs.scope, 'global')))
      .limit(1);
    return NextResponse.json({ config: config ?? null });
  } catch (error) {
    return handleApiError({ error, route: '/api/agent-config GET' });
  }
});

export const PUT = withPermission('dashboard.read', async (request: Request, _p, authContext) => {
  try {
    const organizationId = authContext.orgId;
    const body = (await request.json()) as {
      tone?: string;
      emojiUse?: string;
      responseLength?: string;
      escalationRules?: string;
      specialInstructions?: string;
    };

    const [existing] = await db
      .select({ id: agentConfigs.id })
      .from(agentConfigs)
      .where(and(eq(agentConfigs.organizationId, organizationId), eq(agentConfigs.scope, 'global')))
      .limit(1);

    const now = new Date();
    if (existing) {
      const [updated] = await db
        .update(agentConfigs)
        .set({ ...body, updatedAt: now })
        .where(eq(agentConfigs.id, existing.id))
        .returning();
      return NextResponse.json({ config: updated });
    } else {
      const [created] = await db
        .insert(agentConfigs)
        .values({
          id: uuidv4(),
          organizationId,
          scope: 'global',
          ...body,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return NextResponse.json({ config: created }, { status: 201 });
    }
  } catch (error) {
    return handleApiError({ error, route: '/api/agent-config PUT' });
  }
});
```

- [ ] **Step 2: Create per-property agent config route**

```typescript
// apps/web/src/app/api/properties/[id]/agent-config/route.ts
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { agentConfigs } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

export const GET = withPermission(
  'dashboard.read',
  async (_req, { params }: Params, authContext) => {
    try {
      const { id: propertyId } = await params;
      const organizationId = authContext.orgId;
      const [config] = await db
        .select()
        .from(agentConfigs)
        .where(
          and(
            eq(agentConfigs.organizationId, organizationId),
            eq(agentConfigs.scope, 'property'),
            eq(agentConfigs.propertyId, propertyId),
          ),
        )
        .limit(1);
      return NextResponse.json({ config: config ?? null });
    } catch (error) {
      return handleApiError({ error, route: '/api/properties/[id]/agent-config GET' });
    }
  },
);

export const PUT = withPermission(
  'dashboard.read',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { id: propertyId } = await params;
      const organizationId = authContext.orgId;
      const body = (await request.json()) as {
        tone?: string;
        emojiUse?: string;
        responseLength?: string;
        escalationRules?: string;
        specialInstructions?: string;
      };

      const [existing] = await db
        .select({ id: agentConfigs.id })
        .from(agentConfigs)
        .where(
          and(
            eq(agentConfigs.organizationId, organizationId),
            eq(agentConfigs.scope, 'property'),
            eq(agentConfigs.propertyId, propertyId),
          ),
        )
        .limit(1);

      const now = new Date();
      if (existing) {
        const [updated] = await db
          .update(agentConfigs)
          .set({ ...body, updatedAt: now })
          .where(eq(agentConfigs.id, existing.id))
          .returning();
        return NextResponse.json({ config: updated });
      } else {
        const [created] = await db
          .insert(agentConfigs)
          .values({
            id: uuidv4(),
            organizationId,
            scope: 'property',
            propertyId,
            ...body,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        return NextResponse.json({ config: created }, { status: 201 });
      }
    } catch (error) {
      return handleApiError({ error, route: '/api/properties/[id]/agent-config PUT' });
    }
  },
);
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @walt/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/agent-config/ apps/web/src/app/api/properties/
git commit -m "feat(api): add global + per-property agent config endpoints"
```

---

## Chunk 3: Inbox UI — Two-Column Layout

### Task 7: Nav collapse toggle

**Files:**

- Modify: `apps/web/src/app/app-chrome.tsx`

- [ ] **Step 1: Add collapse toggle to the sidebar**

The sidebar currently has a fixed `w-56` class. Change it to accept a collapsed state stored in `localStorage`. Since `AppChrome` is a server component, extract a client component `NavSidebar`:

Create `apps/web/src/app/nav-sidebar.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';
import { navLinks } from '@/lib/nav-links';

export function NavSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('nav-collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('nav-collapsed', String(next));
  }

  return (
    <aside
      className={`hidden md:flex fixed top-0 left-0 h-screen bg-gray-900 text-white flex-col z-50 transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      <div
        className={`flex items-center border-b border-gray-800 ${collapsed ? 'justify-center py-4' : 'px-6 py-5 justify-between'}`}
      >
        {!collapsed && <span className="text-xl font-semibold tracking-tight">Walt</span>}
        <button
          onClick={toggle}
          className="text-gray-400 hover:text-white transition-colors text-sm"
          aria-label="Toggle navigation"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-hidden">
        {navLinks.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors ${
              collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2 gap-2'
            }`}
            title={collapsed ? label : undefined}
          >
            {icon && <span className="text-base flex-shrink-0">{icon}</span>}
            {!collapsed && label}
          </Link>
        ))}
      </nav>
      <div className={`border-t border-gray-800 ${collapsed ? 'flex justify-center py-4' : 'px-5 py-4'}`}>
        <UserButton />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Add icons to nav-links**

Check `apps/web/src/lib/nav-links.ts`. Add an `icon` field if it doesn't exist:

```typescript
export const navLinks = [
  { href: '/inbox', label: 'Inbox', icon: '💬' },
  { href: '/properties', label: 'Properties', icon: '🏠' },
  { href: '/tasks', label: 'Tasks', icon: '✅' },
  { href: '/questions', label: 'Questions', icon: '❓' },
  // add others matching your existing nav
];
```

Match whatever links are currently in the file — don't remove any.

- [ ] **Step 3: Update `app-chrome.tsx` to use `NavSidebar`**

Replace the `<aside>` block in `app-chrome.tsx` with:

```typescript
import { NavSidebar } from './nav-sidebar';
// ...
// Replace the <aside>...</aside> block with:
<NavSidebar />
```

Also update `<main>` margin: change `md:ml-56` to `md:ml-14` so content is never hidden behind the collapsed sidebar. The collapsed state is `w-14`, so `md:ml-14` is always safe regardless of collapsed/expanded state. The expanded sidebar (`w-56`) will overlap the content by `56-14 = 168px (10.5rem)`, which is acceptable for v1. Users can collapse the sidebar to give full width to the inbox.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @walt/web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/app-chrome.tsx apps/web/src/app/nav-sidebar.tsx apps/web/src/lib/nav-links.ts
git commit -m "feat(ui): add nav collapse toggle to sidebar"
```

---

### Task 8: Two-column inbox layout

**Files:**

- Modify: `apps/web/src/app/inbox/page.tsx` — thin shell only
- Create: `apps/web/src/app/inbox/InboxClient.tsx` — two-column layout
- Create: `apps/web/src/app/inbox/ConversationList.tsx` — left column
- Create: `apps/web/src/app/inbox/ConversationThread.tsx` — right column wrapper

- [ ] **Step 1: Slim down `inbox/page.tsx` to a shell**

Replace the entire file with:

```typescript
import { InboxClient } from './InboxClient';

export default function InboxPage() {
  return <InboxClient />;
}
```

- [ ] **Step 2: Create `InboxClient.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { ConversationList } from './ConversationList';
import { ConversationThread } from './ConversationThread';

export type InboxThread = {
  reservationId: string;
  guestName: string;
  propertyId: string | null;
  propertyName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  platform: string | null;
  lastBody: string;
  lastSenderType: string;
  lastMessageAt: string;
  unreplied: boolean;
  aiReady: boolean;
  latestMessageId: string | null;
  latestSuggestion: string | null;
};

export function InboxClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // mobile: show thread when selectedId is set
  const showThread = selectedId !== null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#071428' }}>
      {/* Left column — use visibility/positioning (NOT display:none) to preserve scroll position on mobile */}
      <div
        className={`flex-shrink-0 border-r overflow-hidden flex w-full md:w-[30%] ${
          showThread ? 'absolute inset-0 opacity-0 pointer-events-none md:relative md:opacity-100 md:pointer-events-auto' : ''
        }`}
        style={{ borderColor: '#1a3a5c' }}
      >
        <ConversationList
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Right column — hidden on mobile when no thread selected */}
      <div
        className={`flex-1 overflow-hidden ${!showThread ? 'hidden md:flex' : 'flex'} flex-col`}
      >
        {selectedId ? (
          <ConversationThread
            reservationId={selectedId}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: '#334155' }}>
            <p className="text-sm">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `ConversationList.tsx`**

```typescript
'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useCallback } from 'react';
import type { InboxThread } from './InboxClient';

type Filter = 'all' | 'unreplied' | 'ai_ready';

function formatRelativeTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffH = Math.floor(diffMins / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { getToken } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams({ filter, search, per_page: '50' });
      const res = await fetch(`/api/inbox?${params}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = (await res.json()) as { threads: InboxThread[]; total: number };
      setThreads(data.threads ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [filter, search, getToken]);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  const unrepliedCount = threads.filter((t) => t.unreplied).length;
  const aiReadyCount = threads.filter((t) => t.aiReady).length;

  return (
    <div className="flex flex-col h-full w-full" style={{ background: '#0d1f38' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: '#1a3a5c' }}>
        <h1 className="text-sm font-bold mb-3" style={{ color: '#e2e8f0' }}>
          Inbox
        </h1>
        <input
          type="text"
          placeholder="Search guests or properties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-lg border outline-none"
          style={{
            background: '#071428',
            borderColor: '#1a3a5c',
            color: '#94a3b8',
          }}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex border-b" style={{ borderColor: '#1a3a5c' }}>
        {(['all', 'unreplied', 'ai_ready'] as Filter[]).map((f) => {
          const label = f === 'all' ? 'All' : f === 'unreplied' ? 'Unreplied' : 'AI Ready';
          const badge = f === 'unreplied' ? unrepliedCount : f === 'ai_ready' ? aiReadyCount : null;
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 border-b-2 transition-colors"
              style={{
                borderColor: active ? '#3b82f6' : 'transparent',
                color: active ? '#60a5fa' : '#475569',
              }}
            >
              {label}
              {badge != null && badge > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: '#1d4ed8', color: '#93c5fd', fontSize: '9px' }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-xs text-center" style={{ color: '#334155' }}>
            Loading…
          </div>
        ) : threads.length === 0 ? (
          <div className="p-4 text-xs text-center" style={{ color: '#334155' }}>
            No conversations
          </div>
        ) : (
          threads.map((t) => (
            <button
              key={t.reservationId}
              onClick={() => onSelect(t.reservationId)}
              className="w-full text-left px-4 py-3 border-b transition-colors"
              style={{
                borderColor: '#122038',
                background:
                  t.reservationId === selectedId
                    ? '#0f2d52'
                    : 'transparent',
                borderLeft: t.reservationId === selectedId ? '3px solid #3b82f6' : '3px solid transparent',
              }}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: t.unreplied ? '#f1f5f9' : '#cbd5e1' }}
                  >
                    {t.guestName}
                  </span>
                  {t.unreplied && (
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: '#3b82f6' }}
                    />
                  )}
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: '#475569' }}>
                  {formatRelativeTime(t.lastMessageAt)}
                </span>
              </div>
              <p
                className="text-xs truncate mb-1.5"
                style={{ color: '#64748b' }}
              >
                {t.lastBody}
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#334155' }}>
                  {t.propertyName ?? '—'}
                </span>
                {t.aiReady ? (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full border"
                    style={{ background: '#1e3a5f', color: '#60a5fa', borderColor: '#1d4ed8', fontSize: '9px' }}
                  >
                    ✦ AI draft
                  </span>
                ) : t.unreplied ? (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full border"
                    style={{ background: '#1a1a2e', color: '#f87171', borderColor: '#991b1b', fontSize: '9px' }}
                  >
                    unreplied
                  </span>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `ConversationThread.tsx` (wrapper that loads thread page server-side data via API)**

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AiDraftPanel } from './AiDraftPanel';

type Message = {
  id: string;
  reservationId: string;
  body: string;
  senderType: string;
  senderFullName: string | null;
  createdAt: string;
};

type ReservationInfo = {
  guestFirstName: string | null;
  guestLastName: string | null;
  propertyName: string | null;
  propertyId: string | null;
  checkIn: string | null;
  checkOut: string | null;
  platform: string | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ConversationThread({
  reservationId,
  onBack,
}: {
  reservationId: string;
  onBack: () => void;
}) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reservation, setReservation] = useState<ReservationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const fetchMessages = useCallback(
    async (before?: string) => {
      const token = await getToken();
      const params = new URLSearchParams({ limit: '20' });
      if (before) params.set('before', before);
      const res = await fetch(`/api/inbox/${reservationId}/messages?${params}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = (await res.json()) as { messages: Message[]; hasMore: boolean; reservation: ReservationInfo };
      return data;
    },
    [reservationId, getToken],
  );

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    void fetchMessages().then((data) => {
      setMessages(data.messages);
      setReservation(data.reservation);
      setHasMore(data.hasMore);
      setLoading(false);
    });
  }, [reservationId, fetchMessages]);

  async function loadOlder() {
    const oldest = messages[0]?.createdAt;
    if (!oldest) return;
    const data = await fetchMessages(oldest);
    setMessages((prev) => [...data.messages, ...prev]);
    setHasMore(data.hasMore);
  }

  // Find latest unreplied guest message (most recent message is guest = no host reply yet)
  const latestIsGuest =
    messages.length > 0 && messages[messages.length - 1]?.senderType === 'guest';
  const unrepliedMessage = latestIsGuest ? messages[messages.length - 1] ?? null : null;

  const guestName =
    [reservation?.guestFirstName, reservation?.guestLastName].filter(Boolean).join(' ') || 'Guest';

  return (
    <div className="flex flex-col h-full" style={{ background: '#071428' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: '#1a3a5c' }}
      >
        <button
          onClick={onBack}
          className="md:hidden text-sm mr-1"
          style={{ color: '#475569' }}
        >
          ←
        </button>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: '#1d4ed8', color: '#fff' }}
        >
          {initials(guestName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: '#f1f5f9' }}>
            {guestName}
          </p>
          <p className="text-xs truncate" style={{ color: '#475569' }}>
            {reservation?.propertyName ?? '—'}
            {reservation?.checkIn &&
              ` · ${new Date(reservation.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            {reservation?.checkOut &&
              ` – ${new Date(reservation.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            {reservation?.platform && ` · ${reservation.platform}`}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-xs text-center" style={{ color: '#334155' }}>
            Loading…
          </p>
        ) : (
          <>
            {hasMore && (
              <button
                onClick={() => void loadOlder()}
                className="text-xs text-center w-full py-1"
                style={{ color: '#475569' }}
              >
                Load older messages
              </button>
            )}
            {messages.map((m) => {
              const isHost = m.senderType === 'host';
              const isUnreplied = m === unrepliedMessage;
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 max-w-[75%] ${isHost ? 'self-end flex-row-reverse' : ''}`}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: isHost ? '#1d4ed8' : '#1e293b', color: isHost ? '#fff' : '#94a3b8' }}
                  >
                    {initials(m.senderFullName ?? (isHost ? 'Host' : guestName))}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div
                      className="px-3 py-2 text-xs leading-relaxed"
                      style={{
                        background: isHost ? '#1d4ed8' : '#0d1f38',
                        color: isHost ? '#eff6ff' : '#e2e8f0',
                        borderRadius: isHost ? '10px 4px 10px 10px' : '4px 10px 10px 10px',
                        border: isUnreplied ? '1px solid #3b82f6' : isHost ? 'none' : '1px solid #1a3a5c',
                      }}
                    >
                      {m.body}
                    </div>
                    <div
                      className={`flex items-center gap-1.5 text-xs ${isHost ? 'justify-end' : ''}`}
                      style={{ color: '#334155' }}
                    >
                      <span>{formatTime(m.createdAt)}</span>
                      {isUnreplied && (
                        <span
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '9px' }}
                        >
                          needs reply
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* AI Draft Panel */}
      {reservation && (
        <AiDraftPanel
          reservationId={reservationId}
          propertyId={reservation.propertyId}
          unrepliedMessage={unrepliedMessage}
          onSent={() => {
            // Refresh messages after send
            void fetchMessages().then((data) => {
              setMessages(data.messages);
              setHasMore(data.hasMore);
            });
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Update the existing messages API to return reservation info**

Open `apps/web/src/app/api/inbox/[reservationId]/messages/route.ts` and add `reservation` to the response. Check its current shape and add:

```typescript
// After fetching messages, also fetch the reservation:
const [reservation] = await db
  .select({
    guestFirstName: reservations.guestFirstName,
    guestLastName: reservations.guestLastName,
    propertyName: reservations.propertyName,
    propertyId: reservations.propertyId,
    checkIn: reservations.checkIn,
    checkOut: reservations.checkOut,
    platform: reservations.platform,
  })
  .from(reservations)
  .where(eq(reservations.id, reservationId));

// Add to the return:
return NextResponse.json({ messages: serialized, hasMore, reservation: reservation ?? null });
```

Also add the `before` cursor param:

```typescript
const before = url.searchParams.get('before'); // ISO timestamp
// Add to where clause: before ? lt(messages.createdAt, new Date(before)) : undefined
```

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @walt/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/inbox/ apps/web/src/app/api/inbox/\[reservationId\]/messages/
git commit -m "feat(ui): two-column inbox with conversation list and thread view"
```

---

## Chunk 4: AI Draft Panel + Hints

### Task 9: `AiDraftPanel` component

**Files:**

- Create: `apps/web/src/app/inbox/AiDraftPanel.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { LearningToast } from './LearningToast';

type Message = { id: string; body: string };

const CHIPS = [
  { key: 'shorter', label: 'Shorter' },
  { key: 'no_emoji', label: 'No emoji' },
  { key: 'formal', label: 'More formal' },
  { key: 'friendly', label: 'More friendly' },
  { key: 'more_detail', label: '+ Add detail' },
];

export function AiDraftPanel({
  reservationId,
  propertyId,
  unrepliedMessage,
  onSent,
}: {
  reservationId: string;
  propertyId: string | null;
  unrepliedMessage: Message | null;
  onSent: () => void;
}) {
  const { getToken } = useAuth();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const [extraContext, setExtraContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [manualReply, setManualReply] = useState('');
  const [pendingFacts, setPendingFacts] = useState<Array<{ text: string; type: string }>>([]);

  // Auto-generate draft when a new unreplied message appears
  useEffect(() => {
    if (!unrepliedMessage) return;
    setDismissed(false);
    setSuggestion(null);
    setActiveChips([]);
    setExtraContext('');
    void generate(unrepliedMessage.id, [], '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unrepliedMessage?.id]);

  async function generate(messageId: string, chips: string[], context: string) {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/inbox/${reservationId}/suggest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messageId, chips, extraContext: context || undefined }),
      });
      const data = (await res.json()) as { suggestion?: string };
      if (data.suggestion) setSuggestion(data.suggestion);
    } finally {
      setLoading(false);
    }
  }

  function toggleChip(key: string) {
    setActiveChips((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    );
  }

  async function handleSend(body: string) {
    setSending(true);
    try {
      const token = await getToken();
      await fetch(`/api/inbox/${reservationId}/send`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ suggestion: body }),
      });

      // Copy to clipboard
      await navigator.clipboard.writeText(body).catch(() => {});

      // Detect learnings async
      if (extraContext.trim() && propertyId) {
        const t = await getToken();
        void fetch(`/api/properties/${propertyId}/memory/detect`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(t ? { Authorization: `Bearer ${t}` } : {}),
          },
          body: JSON.stringify({ hintText: extraContext, chips: activeChips, reservationId }),
        })
          .then((r) => r.json() as Promise<{ facts: Array<{ text: string; type: string }> }>)
          .then((data) => {
            const property_facts = data.facts?.filter((f) => f.type === 'property_fact') ?? [];
            if (property_facts.length > 0) setPendingFacts(data.facts);
          });
      }

      setSuggestion(null);
      setDismissed(true);
      setManualReply('');
      onSent();
    } finally {
      setSending(false);
    }
  }

  // Do NOT return null when unrepliedMessage is absent — the manual reply bar must always be visible (spec §3.3)

  return (
    <div className="flex-shrink-0 border-t" style={{ borderColor: '#1a3a5c', background: '#0a1e38' }}>
      {/* Learning toast */}
      {pendingFacts.length > 0 && propertyId && (
        <LearningToast
          facts={pendingFacts}
          propertyId={propertyId}
          reservationId={reservationId}
          onDismiss={() => setPendingFacts([])}
          onSaved={() => setPendingFacts([])}
        />
      )}

      {/* Draft section — only when there is an unreplied guest message */}
      {unrepliedMessage && !dismissed && (
        <div className="px-4 py-3 border-b" style={{ borderColor: '#1a3a5c' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span style={{ color: '#60a5fa', fontSize: '12px' }}>✦</span>
              <span className="text-xs font-semibold" style={{ color: '#93c5fd' }}>
                AI Draft
              </span>
              {loading && (
                <span className="text-xs" style={{ color: '#334155' }}>
                  · generating…
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              {suggestion && !loading && (
                <button
                  onClick={() => void handleSend(suggestion)}
                  disabled={sending}
                  className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50"
                  style={{ background: '#14532d', color: '#4ade80' }}
                >
                  {sending ? 'Sending…' : '✓ Approve & Send'}
                </button>
              )}
              {suggestion && !loading && (
                <button
                  onClick={() =>
                    void generate(unrepliedMessage.id, activeChips, extraContext)
                  }
                  className="text-xs px-2.5 py-1.5 rounded-md border transition-colors"
                  style={{ background: '#0d1f38', borderColor: '#1a3a5c', color: '#94a3b8' }}
                >
                  ↺
                </button>
              )}
              <button
                onClick={() => setDismissed(true)}
                className="text-xs px-2 py-1.5 rounded-md border"
                style={{ background: '#0d1f38', borderColor: '#1a3a5c', color: '#475569' }}
              >
                ✕
              </button>
            </div>
          </div>

          {suggestion && !loading && (
            <>
              {/* Draft text */}
              <div
                className="text-xs leading-relaxed rounded-lg px-3 py-2.5 mb-2.5"
                style={{ background: '#071428', border: '1px solid #1a3a5c', color: '#cbd5e1' }}
              >
                {suggestion}
              </div>

              {/* Chips */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {CHIPS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => toggleChip(c.key)}
                    className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                    style={{
                      background: activeChips.includes(c.key) ? '#1e3a5f' : '#0d1f38',
                      borderColor: activeChips.includes(c.key) ? '#3b82f6' : '#1a3a5c',
                      color: activeChips.includes(c.key) ? '#60a5fa' : '#64748b',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Extra context */}
              <input
                type="text"
                placeholder="Extra context for this reply (optional)…"
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (activeChips.length > 0 || extraContext.trim())) {
                    void generate(unrepliedMessage.id, activeChips, extraContext);
                  }
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border outline-none"
                style={{ background: '#071428', borderColor: '#1a3a5c', color: '#94a3b8' }}
              />
              {(activeChips.length > 0 || extraContext.trim()) && (
                <button
                  onClick={() => void generate(unrepliedMessage.id, activeChips, extraContext)}
                  className="mt-2 text-xs px-3 py-1.5 rounded-md border"
                  style={{ background: '#1d4ed8', borderColor: '#1d4ed8', color: '#fff' }}
                >
                  ↺ Regenerate with hints
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Manual reply */}
      <div className="px-4 py-3 flex gap-2 items-center">
        <input
          type="text"
          placeholder="Or type your own message…"
          value={manualReply}
          onChange={(e) => setManualReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && manualReply.trim()) void handleSend(manualReply);
          }}
          className="flex-1 text-xs px-3 py-2 rounded-lg border outline-none"
          style={{ background: '#071428', borderColor: '#1a3a5c', color: '#94a3b8' }}
        />
        <button
          onClick={() => void handleSend(manualReply)}
          disabled={!manualReply.trim() || sending}
          className="text-xs px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          style={{ background: '#1d4ed8', color: '#fff' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @walt/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/inbox/AiDraftPanel.tsx
git commit -m "feat(ui): add AiDraftPanel with chips, extra context, and regenerate"
```

---

## Chunk 5: Learning Toast

### Task 10: `LearningToast` component

**Files:**

- Create: `apps/web/src/app/inbox/LearningToast.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { useAuth } from '@clerk/nextjs';
import { useState } from 'react';

type Fact = { text: string; type: 'property_fact' | 'situational' | string };

export function LearningToast({
  facts,
  propertyId,
  reservationId,
  onDismiss,
  onSaved,
}: {
  facts: Fact[];
  propertyId: string;
  reservationId: string;
  onDismiss: () => void;
  onSaved: () => void;
}) {
  const { getToken } = useAuth();
  const propertyFacts = facts.filter((f) => f.type === 'property_fact');
  const situational = facts.filter((f) => f.type !== 'property_fact');

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveAll() {
    setSaving(true);
    try {
      const token = await getToken();
      await Promise.all(
        propertyFacts.map((f) =>
          fetch(`/api/properties/${propertyId}/memory`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              fact: f.text,
              source: 'learned',
              sourceReservationId: reservationId,
            }),
          }),
        ),
      );
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function saveSingle(text: string) {
    setSaving(true);
    try {
      const token = await getToken();
      await fetch(`/api/properties/${propertyId}/memory`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fact: text, source: 'learned', sourceReservationId: reservationId }),
      });
      setEditingIdx(null);
      if (propertyFacts.length === 1) onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (propertyFacts.length === 0) return null;

  return (
    <div
      className="mx-4 my-3 rounded-xl border p-3"
      style={{ background: '#0a1e38', borderColor: '#1e3a5f', borderLeftColor: '#3b82f6', borderLeftWidth: '3px' }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm">🧠</span>
        <span className="text-xs font-semibold" style={{ color: '#93c5fd' }}>
          I picked up something — save to this property?
        </span>
      </div>

      <div className="flex flex-col gap-1.5 mb-3">
        {propertyFacts.map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg px-2.5 py-2"
            style={{ background: '#071428', border: '1px solid #1a3a5c' }}
          >
            <span
              className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
              style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '9px' }}
            >
              Property fact
            </span>
            {editingIdx === i ? (
              <div className="flex-1 flex gap-1.5">
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="flex-1 text-xs px-2 py-1 rounded border outline-none"
                  style={{ background: '#0d1f38', borderColor: '#3b82f6', color: '#e2e8f0' }}
                />
                <button
                  onClick={() => void saveSingle(editText)}
                  disabled={saving}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: '#14532d', color: '#4ade80' }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingIdx(null)}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: '#1a1a2e', color: '#64748b' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex-1 flex justify-between items-start gap-2">
                <span className="text-xs leading-relaxed" style={{ color: '#e2e8f0' }}>
                  {f.text}
                </span>
                <button
                  onClick={() => { setEditingIdx(i); setEditText(f.text); }}
                  className="text-xs flex-shrink-0"
                  style={{ color: '#475569' }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}

        {situational.map((f, i) => (
          <div
            key={`s-${i}`}
            className="flex items-start gap-2 rounded-lg px-2.5 py-2 opacity-40"
            style={{ background: '#071428', border: '1px solid #1a3a5c' }}
          >
            <span
              className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
              style={{ background: '#1a1a2e', color: '#64748b', fontSize: '9px' }}
            >
              One-off
            </span>
            <span className="text-xs" style={{ color: '#94a3b8' }}>
              {f.text}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => void saveAll()}
          disabled={saving}
          className="flex-1 text-xs py-1.5 rounded-md font-medium transition-colors disabled:opacity-50"
          style={{ background: '#1d4ed8', color: '#fff' }}
        >
          {saving ? 'Saving…' : '✓ Save to Memory'}
        </button>
        <button
          onClick={onDismiss}
          className="text-xs px-3 py-1.5 rounded-md border"
          style={{ background: '#0d1f38', borderColor: '#1a3a5c', color: '#94a3b8' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Final typecheck and lint**

```bash
pnpm --filter @walt/web typecheck && pnpm --filter @walt/web lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/inbox/LearningToast.tsx
git commit -m "feat(ui): add LearningToast for validated AI memory extraction"
```

---

### Task 11: Final integration check and `.gitignore`

- [ ] **Step 1: Add `.superpowers/` to `.gitignore`**

```bash
echo ".superpowers/" >> .gitignore
git add .gitignore
```

- [ ] **Step 2: Run full typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: all pass.

- [ ] **Step 3: Push branch**

```bash
git push origin feat/inbox-redesign
```

---

## Notes for Implementer

### Auth context pattern

`withPermission(permission, handler)` passes `authContext: AuthContext` as the **third argument** to the handler. Use `authContext.orgId` to get the organization ID. The type is imported from `@walt/contracts`. All new routes in this plan use this pattern. The `reservations` and `messages` tables do not have an `organizationId` column (pre-existing schema limitation); org-level scoping for those tables is deferred to a future migration.

### Existing inbox pages

The current `apps/web/src/app/inbox/[reservationId]/page.tsx` and its components (`MessageThread.tsx`, `SuggestionPanel.tsx`) can remain intact — they are no longer linked from the new two-column inbox but may be useful as reference. Delete them in a follow-up cleanup PR once the new inbox is stable.

### Color scheme

All inline styles use the dark blue palette from the spec. The existing Tailwind `bg-gray-*` classes are preserved for the rest of the app — only inbox components use inline dark-blue styles. A future task can extract a shared color theme.
