# Turnover Checklists Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a per-property turnover checklist system where hosts manage template items, create shareable runs per guest turnover, and cleaners check items off via a public link — with soft-delete and full audit trail.

**Architecture:** Three new DB tables (`checklist_items`, `checklist_runs`, `checklist_run_entries`). Host-facing pages/APIs require Clerk auth via `withAuth`. Cleaner-facing run page is public, gated only by a random token. Checklist items are soft-deleted (deletedAt timestamp). Audit trail = every check/uncheck appends a new row to `checklist_run_entries`.

**Tech Stack:** Next.js 15 server components + client components, Drizzle ORM, PostgreSQL (walt schema), Tailwind CSS, Clerk auth (`withAuth` from `@/lib/auth/authorize`), `nanoid` for URL-safe tokens, `zod` for validation.

---

### Task 1: Add DB schema + generate migration

**Files:**
- Modify: `packages/db/src/schema.ts`

**Context:**
- All tables go in the `waltSchema` (`pgSchema('walt')`)
- Follow existing patterns: uuid PK, timestamps with timezone
- `nanoid` tokens for `checklist_runs` (stored as text, unique index)

**Step 1: Add the three tables to `packages/db/src/schema.ts`**

After the `messages` table, add:

```ts
export const checklistItems = waltSchema.table('checklist_items', {
  id: uuid('id').primaryKey(),
  propertyId: text('property_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull()
});

export const checklistRuns = waltSchema.table('checklist_runs', {
  id: uuid('id').primaryKey(),
  propertyId: text('property_id').notNull(),
  token: text('token').notNull(),
  label: text('label'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  createdBy: text('created_by').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true })
}, (table) => ({
  tokenIdx: uniqueIndex('checklist_runs_token_idx').on(table.token)
}));

export const checklistRunEntries = waltSchema.table('checklist_run_entries', {
  id: uuid('id').primaryKey(),
  runId: uuid('run_id').notNull().references(() => checklistRuns.id),
  itemId: uuid('item_id').notNull().references(() => checklistItems.id),
  checked: text('checked').notNull(), // 'true' | 'false' stored as text to keep it simple
  checkedBy: text('checked_by').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull()
});
```

Note: `checked` is stored as text `'true'`/`'false'` to avoid boolean migration complexity. Use a boolean column if you prefer — but text is simpler with Drizzle.

Actually, use a proper boolean:

```ts
export const checklistRunEntries = waltSchema.table('checklist_run_entries', {
  id: uuid('id').primaryKey(),
  runId: uuid('run_id').notNull().references(() => checklistRuns.id),
  itemId: uuid('item_id').notNull().references(() => checklistItems.id),
  checked: integer('checked').notNull(), // 1 = checked, 0 = unchecked (audit entry)
  checkedBy: text('checked_by').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull()
});
```

**Step 2: Generate the migration**

```bash
cd packages/db
pnpm drizzle-kit generate
```

Expected: Creates `drizzle/0004_*.sql` with CREATE TABLE statements for the 3 tables.

**Step 3: Verify the migration file looks correct**

Open the new `.sql` file and confirm it has:
- `CREATE TABLE "walt"."checklist_items"` with all columns
- `CREATE TABLE "walt"."checklist_runs"` with unique index on token
- `CREATE TABLE "walt"."checklist_run_entries"` with FK references

**Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat: add checklist_items, checklist_runs, checklist_run_entries tables"
```

---

### Task 2: Install nanoid + add host-facing checklist items API

**Files:**
- Create: `apps/web/src/app/api/checklists/items/route.ts`
- Create: `apps/web/src/app/api/checklists/items/[id]/route.ts`

**Context:**
- Auth via `withAuth` from `@/lib/auth/authorize`
- Pattern: `export const GET = withAuth(async (request, _ctx, _auth) => { ... })`
- `checklistItems` exported from `@walt/db`
- Install `nanoid` in `apps/web`: `pnpm --filter web add nanoid`

**Step 1: Install nanoid**

```bash
pnpm --filter web add nanoid
```

**Step 2: Create `apps/web/src/app/api/checklists/items/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { asc, eq, isNull } from 'drizzle-orm';
import { checklistItems } from '@walt/db';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth/authorize';

const createSchema = z.object({
  propertyId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().optional()
});

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('propertyId');
  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
  }
  const items = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.propertyId, propertyId))
    .orderBy(asc(checklistItems.sortOrder), asc(checklistItems.createdAt));
  return NextResponse.json({ data: items });
});

export const POST = withAuth(async (request) => {
  const body = (await request.json()) as unknown;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const now = new Date();
  const [item] = await db
    .insert(checklistItems)
    .values({
      id: uuidv4(),
      propertyId: parsed.data.propertyId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
      createdAt: now
    })
    .returning();
  return NextResponse.json({ data: item }, { status: 201 });
});
```

**Step 3: Create `apps/web/src/app/api/checklists/items/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { checklistItems } from '@walt/db';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth/authorize';

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional()
});

export const PATCH = withAuth(async (request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const body = (await request.json()) as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  await db
    .update(checklistItems)
    .set({ ...parsed.data })
    .where(eq(checklistItems.id, id));
  return NextResponse.json({ ok: true });
});

// Soft delete
export const DELETE = withAuth(async (_request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  await db
    .update(checklistItems)
    .set({ deletedAt: new Date() })
    .where(eq(checklistItems.id, id));
  return NextResponse.json({ ok: true });
});
```

**Step 4: Run typecheck**

```bash
pnpm --filter web typecheck
```

Expected: no errors.

**Step 5: Commit**

```bash
git add apps/web/src/app/api/checklists/
git commit -m "feat: add checklist items CRUD API"
```

---

### Task 3: Host-facing checklist runs API

**Files:**
- Create: `apps/web/src/app/api/checklists/runs/route.ts`
- Create: `apps/web/src/app/api/checklists/runs/[token]/route.ts`

**Step 1: Create `apps/web/src/app/api/checklists/runs/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import { asc, desc, eq } from 'drizzle-orm';
import { checklistRuns } from '@walt/db';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth/authorize';

const createSchema = z.object({
  propertyId: z.string().min(1),
  label: z.string().optional()
});

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('propertyId');
  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
  }
  const runs = await db
    .select()
    .from(checklistRuns)
    .where(eq(checklistRuns.propertyId, propertyId))
    .orderBy(desc(checklistRuns.createdAt));
  return NextResponse.json({ data: runs });
});

export const POST = withAuth(async (request, _ctx, auth) => {
  const body = (await request.json()) as unknown;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const now = new Date();
  const [run] = await db
    .insert(checklistRuns)
    .values({
      id: uuidv4(),
      propertyId: parsed.data.propertyId,
      token: nanoid(12),
      label: parsed.data.label ?? null,
      createdAt: now,
      createdBy: auth.userId
    })
    .returning();
  return NextResponse.json({ data: run }, { status: 201 });
});
```

**Step 2: Create `apps/web/src/app/api/checklists/runs/[token]/route.ts`**

This is the **public** endpoint the cleaner uses — no auth, just a valid token.

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { checklistRuns, checklistItems, checklistRunEntries } from '@walt/db';
import { db } from '@/lib/db';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const [run] = await db
    .select()
    .from(checklistRuns)
    .where(eq(checklistRuns.token, token));

  if (!run) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Active items for this property (not soft-deleted)
  const items = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.propertyId, run.propertyId));

  // All entries for this run (audit trail)
  const entries = await db
    .select()
    .from(checklistRunEntries)
    .where(eq(checklistRunEntries.runId, run.id));

  // Compute current state: latest entry per itemId
  const stateMap = new Map<string, { checked: number; checkedBy: string }>();
  for (const entry of entries) {
    stateMap.set(entry.itemId, { checked: entry.checked, checkedBy: entry.checkedBy });
  }

  const itemsWithState = items.map((item) => ({
    ...item,
    currentState: stateMap.get(item.id) ?? { checked: 0, checkedBy: null }
  }));

  return NextResponse.json({ data: { run, items: itemsWithState, entries } });
}
```

**Step 3: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/api/checklists/runs/
git commit -m "feat: add checklist runs API (host + public token endpoint)"
```

---

### Task 4: Cleaner check/uncheck API

**Files:**
- Create: `apps/web/src/app/api/checklists/runs/[token]/check/route.ts`

**Step 1: Create the file**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { and, eq } from 'drizzle-orm';
import { checklistRuns, checklistItems, checklistRunEntries } from '@walt/db';
import { db } from '@/lib/db';

const checkSchema = z.object({
  itemId: z.string().uuid(),
  checked: z.boolean(),
  checkedBy: z.string().min(1),
  notes: z.string().optional()
});

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  // Verify run exists
  const [run] = await db
    .select()
    .from(checklistRuns)
    .where(eq(checklistRuns.token, token));
  if (!run) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await request.json()) as unknown;
  const parsed = checkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Verify item belongs to this run's property
  const [item] = await db
    .select()
    .from(checklistItems)
    .where(and(eq(checklistItems.id, parsed.data.itemId), eq(checklistItems.propertyId, run.propertyId)));
  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const now = new Date();

  // Append audit entry
  await db.insert(checklistRunEntries).values({
    id: uuidv4(),
    runId: run.id,
    itemId: parsed.data.itemId,
    checked: parsed.data.checked ? 1 : 0,
    checkedBy: parsed.data.checkedBy,
    notes: parsed.data.notes ?? null,
    createdAt: now
  });

  // Mark run complete if all active items are now checked
  const allItems = await db
    .select()
    .from(checklistItems)
    .where(and(eq(checklistItems.propertyId, run.propertyId)));

  const activeItems = allItems.filter((i) => !i.deletedAt);

  // Get latest entry per item
  const allEntries = await db
    .select()
    .from(checklistRunEntries)
    .where(eq(checklistRunEntries.runId, run.id));

  const latestByItem = new Map<string, number>();
  for (const entry of allEntries) {
    latestByItem.set(entry.itemId, entry.checked);
  }

  const allChecked = activeItems.every((i) => latestByItem.get(i.id) === 1);
  if (allChecked && !run.completedAt) {
    await db
      .update(checklistRuns)
      .set({ completedAt: now })
      .where(eq(checklistRuns.id, run.id));
  }

  return NextResponse.json({ ok: true });
}
```

**Step 2: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/app/api/checklists/runs/
git commit -m "feat: add cleaner check/uncheck endpoint with audit trail"
```

---

### Task 5: Host checklists page

**Files:**
- Create: `apps/web/src/app/checklists/page.tsx`
- Create: `apps/web/src/app/checklists/ChecklistManager.tsx`

**Context:**
- `page.tsx` is a server component — fetches properties + runs from DB directly
- `ChecklistManager.tsx` is a client component — handles item CRUD, creating runs, copying links
- Pattern: follow `apps/web/src/app/questions/page.tsx` and `FaqEditor.tsx`

**Step 1: Create `apps/web/src/app/checklists/page.tsx`**

```tsx
import { asc, desc, isNull } from 'drizzle-orm';
import { properties, checklistItems, checklistRuns } from '@walt/db';
import { db } from '@/lib/db';
import { ChecklistManager } from './ChecklistManager';

export default async function ChecklistsPage() {
  const [allProperties, allItems, allRuns] = await Promise.all([
    db.select({ id: properties.id, name: properties.name }).from(properties).orderBy(asc(properties.name)),
    db.select().from(checklistItems).orderBy(asc(checklistItems.sortOrder), asc(checklistItems.createdAt)),
    db.select().from(checklistRuns).orderBy(desc(checklistRuns.createdAt))
  ]);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Turnover Checklists</h1>
        <p className="text-sm text-gray-500 mt-1">Manage checklist templates and create turnover runs for your cleaner.</p>
      </div>

      {allProperties.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          No properties yet. Sync data first.
        </div>
      ) : (
        <ChecklistManager properties={allProperties} initialItems={allItems} initialRuns={allRuns} />
      )}
    </div>
  );
}
```

**Step 2: Create `apps/web/src/app/checklists/ChecklistManager.tsx`**

```tsx
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Property = { id: string; name: string };
type ChecklistItem = {
  id: string; propertyId: string; title: string; description: string | null;
  sortOrder: number; deletedAt: Date | null; createdAt: Date;
};
type ChecklistRun = {
  id: string; propertyId: string; token: string; label: string | null;
  createdAt: Date; createdBy: string; completedAt: Date | null;
};

export function ChecklistManager({
  properties,
  initialItems,
  initialRuns
}: {
  properties: Property[];
  initialItems: ChecklistItem[];
  initialRuns: ChecklistRun[];
}) {
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?.id ?? '');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newRunLabel, setNewRunLabel] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [creatingRun, setCreatingRun] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const items = initialItems.filter((i) => i.propertyId === selectedPropertyId);
  const activeItems = items.filter((i) => !i.deletedAt);
  const runs = initialRuns.filter((r) => r.propertyId === selectedPropertyId);

  async function addItem() {
    if (!newItemTitle.trim()) return;
    setAdding(true);
    await fetch('/api/checklists/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: selectedPropertyId, title: newItemTitle.trim() })
    });
    setNewItemTitle('');
    setAdding(false);
    startTransition(() => router.refresh());
  }

  async function softDeleteItem(id: string) {
    await fetch(`/api/checklists/items/${id}`, { method: 'DELETE' });
    startTransition(() => router.refresh());
  }

  async function createRun() {
    setCreatingRun(true);
    await fetch('/api/checklists/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: selectedPropertyId, label: newRunLabel.trim() || undefined })
    });
    setNewRunLabel('');
    setCreatingRun(false);
    startTransition(() => router.refresh());
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/checklists/run/${token}`;
    void navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  return (
    <div className="space-y-8">
      {/* Property selector */}
      <div>
        <label className="text-sm font-medium text-gray-700 mr-3">Property</label>
        <select
          value={selectedPropertyId}
          onChange={(e) => setSelectedPropertyId(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Template items */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Checklist Template</h2>

        {activeItems.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">No items yet. Add your first checklist item below.</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {activeItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-800">{item.title}</span>
                <button
                  onClick={() => softDeleteItem(item.id)}
                  className="text-xs text-red-400 hover:text-red-600 ml-4"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addItem(); }}
            placeholder="New checklist item…"
            className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <button
            onClick={() => void addItem()}
            disabled={adding || !newItemTitle.trim()}
            className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>

      {/* Create run */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Create Turnover Run</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newRunLabel}
            onChange={(e) => setNewRunLabel(e.target.value)}
            placeholder="Label (optional, e.g. April 5 turnover)"
            className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <button
            onClick={() => void createRun()}
            disabled={creatingRun || activeItems.length === 0}
            className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            {creatingRun ? 'Creating…' : 'New Run'}
          </button>
        </div>
        {activeItems.length === 0 && (
          <p className="text-xs text-gray-400 mt-2">Add checklist items first.</p>
        )}
      </div>

      {/* Run history */}
      {runs.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Run History</h2>
          <div className="space-y-3">
            {runs.map((run) => (
              <div key={run.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-800">{run.label ?? 'Unlabelled run'}</span>
                  <span className="text-gray-400 ml-2">
                    {new Date(run.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className={`ml-2 text-xs font-medium ${run.completedAt ? 'text-green-600' : 'text-yellow-600'}`}>
                    {run.completedAt ? '✓ Completed' : '● In progress'}
                  </span>
                </div>
                <button
                  onClick={() => copyLink(run.token)}
                  className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
                >
                  {copiedToken === run.token ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/checklists/
git commit -m "feat: add checklists host page with template management and run history"
```

---

### Task 6: Cleaner run page (public, no login)

**Files:**
- Create: `apps/web/src/app/checklists/run/[token]/page.tsx`
- Create: `apps/web/src/app/checklists/run/[token]/RunChecklist.tsx`

**Context:**
- This page must be accessible without auth. Clerk middleware must NOT redirect it.
- Check `apps/web/src/middleware.ts` (or wherever Clerk middleware is) — add `/checklists/run/(.*)` to the public routes matcher.

**Step 1: Find and update the Clerk middleware**

Look for `middleware.ts` in `apps/web/src/`:

```bash
ls apps/web/src/middleware.ts
```

If it exists, add `/checklists/run/(.*)` to the `publicRoutes` array. If it doesn't exist, create it:

```ts
// apps/web/src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/api/integrations/hospitable(.*)',
  '/checklists/run/(.*)'
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)']
};
```

**Step 2: Create `apps/web/src/app/checklists/run/[token]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { checklistRuns, properties } from '@walt/db';
import { db } from '@/lib/db';
import { RunChecklist } from './RunChecklist';

export default async function RunPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [run] = await db
    .select()
    .from(checklistRuns)
    .where(eq(checklistRuns.token, token));

  if (!run) notFound();

  const [property] = await db
    .select({ name: properties.name })
    .from(properties)
    .where(eq(properties.id, run.propertyId));

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">{property?.name ?? 'Property'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {run.label ?? 'Turnover checklist'}
            {run.completedAt && (
              <span className="ml-2 text-green-600 font-medium">· Completed</span>
            )}
          </p>
        </div>
        <RunChecklist token={token} />
      </div>
    </div>
  );
}
```

**Step 3: Create `apps/web/src/app/checklists/run/[token]/RunChecklist.tsx`**

```tsx
'use client';
import { useState, useEffect } from 'react';

type ItemState = {
  id: string;
  title: string;
  description: string | null;
  deletedAt: Date | null;
  currentState: { checked: number; checkedBy: string | null };
};

export function RunChecklist({ token }: { token: string }) {
  const [items, setItems] = useState<ItemState[]>([]);
  const [cleanerName, setCleanerName] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = sessionStorage.getItem('cleanerName');
    if (saved) { setCleanerName(saved); setNameSet(true); }

    void fetch(`/api/checklists/runs/${token}`)
      .then((r) => r.json())
      .then((body: { data?: { items: ItemState[] } }) => {
        setItems(body.data?.items ?? []);
        setLoading(false);
      });
  }, [token]);

  function confirmName() {
    if (!cleanerName.trim()) return;
    sessionStorage.setItem('cleanerName', cleanerName.trim());
    setNameSet(true);
  }

  async function toggle(itemId: string, currentChecked: number) {
    setSaving(itemId);
    const newChecked = currentChecked === 1 ? false : true;
    await fetch(`/api/checklists/runs/${token}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, checked: newChecked, checkedBy: cleanerName })
    });
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, currentState: { checked: newChecked ? 1 : 0, checkedBy: cleanerName } } : i
      )
    );
    setSaving(null);
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (!nameSet) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Enter your name to get started</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={cleanerName}
            onChange={(e) => setCleanerName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmName(); }}
            placeholder="Your name"
            className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
            autoFocus
          />
          <button
            onClick={confirmName}
            disabled={!cleanerName.trim()}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  const activeItems = items.filter((i) => !i.deletedAt);
  const checkedCount = activeItems.filter((i) => i.currentState.checked === 1).length;
  const allDone = checkedCount === activeItems.length && activeItems.length > 0;

  return (
    <div className="space-y-4">
      {allDone && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center text-green-800 font-medium">
          All done! Great work, {cleanerName}.
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
        {activeItems.map((item) => {
          const checked = item.currentState.checked === 1;
          return (
            <label
              key={item.id}
              className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors ${saving === item.id ? 'opacity-50' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => void toggle(item.id, item.currentState.checked)}
                disabled={saving === item.id}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
              />
              <div>
                <p className={`text-sm font-medium ${checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-right">
        {checkedCount} / {activeItems.length} completed · Logged as {cleanerName}
      </p>
    </div>
  );
}
```

**Step 4: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/app/checklists/run/ apps/web/src/middleware.ts
git commit -m "feat: add public cleaner run page with name capture and live checkboxes"
```

---

### Task 7: Add Checklists to sidebar nav + run migration in production

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

**Step 1: Add Checklists to navLinks in `apps/web/src/app/layout.tsx`**

Find the `navLinks` array (around line 12) and add the Checklists entry:

```ts
const navLinks = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/reservations', label: 'Reservations' },
  { href: '/properties', label: 'Properties' },
  { href: '/questions', label: 'Questions' },
  { href: '/checklists', label: 'Checklists' }
];
```

**Step 2: Run lint**

```bash
pnpm --filter web lint
```

**Step 3: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat: add Checklists to sidebar navigation"
```

**Step 5: Push and raise PR**

```bash
git push
```

Then raise a PR — the CI/CD pipeline runs `db:migrate` on deploy which will apply the new migration automatically.
