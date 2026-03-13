# Tasks Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `services/tasks` microservice with full CRUD, soft deletes, audit trail, and a mobile-first UI integrated into the global nav and the properties page.

**Architecture:** New Fastify microservice on port 4105 with PostgreSQL via Drizzle ORM (injected for testability). Gateway proxies `/tasks/*` and `/task-categories/*` routes, forwarding org/user context as headers. Next.js API routes at `/api/tasks/*` proxy to the gateway. A single `tasks.tsx` React component powers both the global `/tasks` page and any property-scoped view.

**Tech Stack:** Node.js `node:test` + Fastify inject for service tests, Drizzle ORM, Next.js App Router, Tailwind CSS, `@clerk/nextjs/server` for auth context in API routes.

---

### Task 1: Add tasks DB tables to schema

**Files:**

- Modify: `packages/db/src/schema.ts`

**Step 1: Add the three new tables**

Add to the bottom of `packages/db/src/schema.ts`:

```typescript
export const taskCategories = waltSchema.table('task_categories', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  createdBy: text('created_by').notNull(),
});

export const tasks = waltSchema.table('tasks', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('open'),
  priority: text('priority').notNull().default('medium'),
  categoryId: uuid('category_id'),
  assigneeId: text('assignee_id'),
  propertyIds: text('property_ids').array().notNull().default([]),
  dueDate: timestamp('due_date', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: text('resolved_by'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: text('deleted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  createdBy: text('created_by').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  updatedBy: text('updated_by').notNull(),
});

export const taskAuditEvents = waltSchema.table('task_audit_events', {
  id: uuid('id').primaryKey(),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id),
  organizationId: uuid('organization_id').notNull(),
  action: text('action').notNull(),
  changedBy: text('changed_by').notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull(),
  delta: jsonb('delta').notNull(),
});
```

Note: `propertyIds` is `text[]` because property IDs come from Hospitable and are stored as `text` in the `properties` table.

**Step 2: Verify TypeScript compiles**

```bash
pnpm --filter @walt/db typecheck
```

Expected: no errors.

**Step 3: Generate migration**

```bash
pnpm --filter @walt/db db:generate
```

Expected: new file created in `packages/db/drizzle/` with `CREATE TABLE walt.task_categories`, `walt.tasks`, `walt.task_audit_events`.

**Step 4: Run migration (requires postgres running)**

```bash
pnpm --filter @walt/db db:migrate
```

Expected: migration applied, no errors.

**Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat(db): add task_categories, tasks, task_audit_events tables"
```

---

### Task 2: Add tasks Zod contracts

**Files:**

- Create: `packages/contracts/src/tasks.ts`
- Modify: `packages/contracts/src/index.ts`

**Step 1: Create the contracts file**

Create `packages/contracts/src/tasks.ts`:

```typescript
import { z } from 'zod';

export const taskPrioritySchema = z.enum(['low', 'medium', 'high']);
export const taskStatusSchema = z.enum(['open', 'resolved', 'deleted']);
export const taskAuditActionSchema = z.enum([
  'created',
  'updated',
  'resolved',
  'restored',
  'deleted',
  'category_deleted',
]);

export const taskCategorySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  color: z.string().nullish(),
  deletedAt: z.string().nullish(),
  createdAt: z.string(),
  createdBy: z.string(),
});

export const taskSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullish(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  categoryId: z.string().uuid().nullish(),
  assigneeId: z.string().nullish(),
  propertyIds: z.array(z.string()),
  dueDate: z.string().nullish(),
  resolvedAt: z.string().nullish(),
  resolvedBy: z.string().nullish(),
  deletedAt: z.string().nullish(),
  deletedBy: z.string().nullish(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
});

export const taskAuditEventSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  organizationId: z.string().uuid(),
  action: taskAuditActionSchema,
  changedBy: z.string(),
  changedAt: z.string(),
  delta: z.record(z.unknown()),
});

export const createTaskInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: taskPrioritySchema,
  categoryId: z.string().uuid().optional(),
  assigneeId: z.string().optional(),
  propertyIds: z.array(z.string()).min(1),
  dueDate: z.string().optional(),
});

export const updateTaskInputSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullish(),
  priority: taskPrioritySchema.optional(),
  categoryId: z.string().uuid().nullish(),
  assigneeId: z.string().nullish(),
  propertyIds: z.array(z.string()).min(1).optional(),
  dueDate: z.string().nullish(),
});

export const createTaskCategoryInputSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

export const updateTaskCategoryInputSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().nullish(),
});

export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskAuditAction = z.infer<typeof taskAuditActionSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskCategory = z.infer<typeof taskCategorySchema>;
export type TaskAuditEvent = z.infer<typeof taskAuditEventSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
export type CreateTaskCategoryInput = z.infer<typeof createTaskCategoryInputSchema>;
export type UpdateTaskCategoryInput = z.infer<typeof updateTaskCategoryInputSchema>;
```

**Step 2: Export from the contracts barrel**

In `packages/contracts/src/index.ts`, add:

```typescript
export * from './tasks.js';
```

**Step 3: Verify TypeScript compiles**

```bash
pnpm --filter @walt/contracts typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add packages/contracts/src/tasks.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add tasks Zod schemas and types"
```

---

### Task 3: Scaffold services/tasks

**Files:**

- Create: `services/tasks/package.json`
- Create: `services/tasks/tsconfig.json`
- Create: `services/tasks/src/index.ts`
- Create: `services/tasks/src/index.test.ts`

**Step 1: Create package.json**

Create `services/tasks/package.json`:

```json
{
  "name": "@walt/service-tasks",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "node --experimental-strip-types --test src/index.test.ts"
  },
  "dependencies": {
    "@walt/contracts": "workspace:*",
    "@walt/db": "workspace:*"
  }
}
```

**Step 2: Create tsconfig.json**

Create `services/tasks/tsconfig.json`:

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

**Step 3: Create the service entry point with health check only**

Create `services/tasks/src/index.ts`:

```typescript
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { createDb, taskCategories, taskAuditEvents, tasks } from '@walt/db';
import {
  createTaskCategoryInputSchema,
  createTaskInputSchema,
  updateTaskCategoryInputSchema,
  updateTaskInputSchema,
} from '@walt/contracts';

type Db = ReturnType<typeof createDb>;

export function buildTasksApp(db: Db) {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok', service: 'tasks' }));

  return app;
}

export async function startTasksServer() {
  const db = createDb(process.env.DATABASE_URL ?? 'postgres://walt:walt@localhost:5432/walt');
  const app = buildTasksApp(db);
  const port = Number(process.env.PORT ?? 4105);
  await app.listen({ port, host: '0.0.0.0' });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await startTasksServer();
}
```

**Step 4: Write the failing health check test**

Create `services/tasks/src/index.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { createDb } from '@walt/db';
import { buildTasksApp } from './index.js';

const db = createDb(process.env.DATABASE_URL ?? 'postgres://walt:walt@localhost:5432/walt');

void test('GET /health returns ok', async () => {
  const app = buildTasksApp(db);
  const response = await app.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { status: string; service: string };
  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'tasks');
  await app.close();
});
```

**Step 5: Install dependencies**

```bash
pnpm install
```

**Step 6: Run the test to verify it passes**

```bash
pnpm --filter @walt/service-tasks test
```

Expected: 1 passing test.

**Step 7: Verify typecheck**

```bash
pnpm --filter @walt/service-tasks typecheck
```

Expected: no errors.

**Step 8: Commit**

```bash
git add services/tasks/
git commit -m "feat(tasks): scaffold tasks service with health check"
```

---

### Task 4: Implement task category routes

**Files:**

- Modify: `services/tasks/src/index.ts`
- Modify: `services/tasks/src/index.test.ts`

**Step 1: Write failing tests for category CRUD**

Add to `services/tasks/src/index.test.ts`:

```typescript
void test('GET /task-categories returns empty list for new org', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();
  const response = await app.inject({
    method: 'GET',
    url: '/task-categories',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { items: unknown[] };
  assert.deepEqual(payload.items, []);
  await app.close();
});

void test('POST /task-categories creates a category', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();
  const response = await app.inject({
    method: 'POST',
    url: '/task-categories',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { name: 'House', color: '#f59e0b' },
  });

  assert.equal(response.statusCode, 201);
  const payload = response.json() as { item: { id: string; name: string; color: string } };
  assert.equal(payload.item.name, 'House');
  assert.equal(payload.item.color, '#f59e0b');
  await app.close();
});

void test('DELETE /task-categories/:id soft-deletes a category', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/task-categories',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { name: 'Digital' },
  });
  const { item } = createResponse.json() as { item: { id: string } };

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/task-categories/${item.id}`,
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });
  assert.equal(deleteResponse.statusCode, 200);

  const listResponse = await app.inject({
    method: 'GET',
    url: '/task-categories',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });
  const listPayload = listResponse.json() as { items: unknown[] };
  assert.equal(listPayload.items.length, 0);
  await app.close();
});
```

Add `import { randomUUID } from 'node:crypto';` at the top of the test file.

**Step 2: Run tests to verify they fail**

```bash
pnpm --filter @walt/service-tasks test
```

Expected: 3 failing tests (route not found).

**Step 3: Implement category routes in buildTasksApp**

Add after the health check route in `services/tasks/src/index.ts`:

```typescript
// ── Category helpers ──────────────────────────────────────────────────────────

function orgId(request: Parameters<typeof app.get>[1] extends unknown ? unknown : never): string {
  // handled below inline
  return '';
}

// ── Categories ────────────────────────────────────────────────────────────────

app.get('/task-categories', async (request) => {
  const org = (request.headers['x-org-id'] as string) ?? '';
  const rows = await db
    .select()
    .from(taskCategories)
    .where(and(eq(taskCategories.organizationId, org), isNull(taskCategories.deletedAt)));
  return { items: rows };
});

app.post('/task-categories', async (request, reply) => {
  const org = (request.headers['x-org-id'] as string) ?? '';
  const user = (request.headers['x-user-id'] as string) ?? '';
  const parsed = createTaskCategoryInputSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

  const now = new Date();
  const [item] = await db
    .insert(taskCategories)
    .values({
      id: randomUUID(),
      organizationId: org,
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      createdAt: now,
      createdBy: user,
    })
    .returning();
  return reply.status(201).send({ item });
});

app.patch('/task-categories/:id', async (request, reply) => {
  const org = (request.headers['x-org-id'] as string) ?? '';
  const user = (request.headers['x-user-id'] as string) ?? '';
  const { id } = request.params as { id: string };
  const parsed = updateTaskCategoryInputSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

  const [item] = await db
    .update(taskCategories)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
    })
    .where(and(eq(taskCategories.id, id), eq(taskCategories.organizationId, org)))
    .returning();
  if (!item) return reply.status(404).send({ error: 'Category not found' });
  return { item };
});

app.delete('/task-categories/:id', async (request, reply) => {
  const org = (request.headers['x-org-id'] as string) ?? '';
  const user = (request.headers['x-user-id'] as string) ?? '';
  const { id } = request.params as { id: string };

  const [item] = await db
    .update(taskCategories)
    .set({ deletedAt: new Date() })
    .where(and(eq(taskCategories.id, id), eq(taskCategories.organizationId, org)))
    .returning();
  if (!item) return reply.status(404).send({ error: 'Category not found' });
  return { item };
});
```

Remove the dead `orgId` helper stub written in Step 1 above — it was a placeholder.

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @walt/service-tasks test
```

Expected: all passing.

**Step 5: Commit**

```bash
git add services/tasks/src/
git commit -m "feat(tasks): add task category CRUD routes"
```

---

### Task 5: Implement tasks routes + audit logging

**Files:**

- Modify: `services/tasks/src/index.ts`
- Modify: `services/tasks/src/index.test.ts`

**Step 1: Write failing tests for task CRUD**

Add to `services/tasks/src/index.test.ts`:

```typescript
void test('POST /tasks creates a task and writes audit event', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();
  const propertyId = randomUUID();

  const response = await app.inject({
    method: 'POST',
    url: '/tasks',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { title: 'Fix broken lock', priority: 'high', propertyIds: [propertyId] },
  });

  assert.equal(response.statusCode, 201);
  const payload = response.json() as {
    item: { id: string; title: string; status: string; priority: string };
  };
  assert.equal(payload.item.title, 'Fix broken lock');
  assert.equal(payload.item.status, 'open');
  assert.equal(payload.item.priority, 'high');
  await app.close();
});

void test('GET /tasks lists tasks filtered by propertyId', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();
  const propertyId = randomUUID();

  await app.inject({
    method: 'POST',
    url: '/tasks',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { title: 'Clean pool', priority: 'low', propertyIds: [propertyId] },
  });
  await app.inject({
    method: 'POST',
    url: '/tasks',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { title: 'Other property task', priority: 'low', propertyIds: [randomUUID()] },
  });

  const response = await app.inject({
    method: 'GET',
    url: `/tasks?propertyId=${propertyId}`,
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { items: Array<{ title: string }> };
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0]?.title, 'Clean pool');
  await app.close();
});

void test('POST /tasks/:id/resolve marks task resolved', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();
  const propertyId = randomUUID();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/tasks',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { title: 'Replace light bulb', priority: 'low', propertyIds: [propertyId] },
  });
  const { item } = createResponse.json() as { item: { id: string } };

  const resolveResponse = await app.inject({
    method: 'POST',
    url: `/tasks/${item.id}/resolve`,
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });

  assert.equal(resolveResponse.statusCode, 200);
  const resolved = resolveResponse.json() as {
    item: { status: string; resolvedAt: string; resolvedBy: string };
  };
  assert.equal(resolved.item.status, 'resolved');
  assert.ok(resolved.item.resolvedAt);
  assert.equal(resolved.item.resolvedBy, 'user-1');
  await app.close();
});

void test('DELETE /tasks/:id soft-deletes task', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();
  const propertyId = randomUUID();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/tasks',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { title: 'Old task', priority: 'low', propertyIds: [propertyId] },
  });
  const { item } = createResponse.json() as { item: { id: string } };

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/tasks/${item.id}`,
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });
  assert.equal(deleteResponse.statusCode, 200);

  // Should not appear in default list
  const listResponse = await app.inject({
    method: 'GET',
    url: '/tasks',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });
  const listPayload = listResponse.json() as { items: Array<{ id: string }> };
  assert.ok(!listPayload.items.some((t) => t.id === item.id));
  await app.close();
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm --filter @walt/service-tasks test
```

Expected: 4 new failing tests.

**Step 3: Add the audit helper and task routes to buildTasksApp**

After the category routes in `services/tasks/src/index.ts`, add:

```typescript
// ── Audit helper ──────────────────────────────────────────────────────────────

async function writeAudit(
  db: Db,
  opts: {
    taskId: string;
    organizationId: string;
    action: string;
    changedBy: string;
    delta: Record<string, unknown>;
  },
) {
  await db.insert(taskAuditEvents).values({
    id: randomUUID(),
    taskId: opts.taskId,
    organizationId: opts.organizationId,
    action: opts.action,
    changedBy: opts.changedBy,
    changedAt: new Date(),
    delta: opts.delta,
  });
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

app.get('/tasks', async (request) => {
  const org = (request.headers['x-org-id'] as string) ?? '';
  const query = request.query as {
    propertyId?: string;
    status?: string;
    priority?: string;
    categoryId?: string;
    assigneeId?: string;
    includeDeleted?: string;
  };

  const rows = await db.select().from(tasks).where(eq(tasks.organizationId, org));

  const includeDeleted = query.includeDeleted === 'true';
  let filtered = rows.filter((t) => includeDeleted || t.deletedAt === null);

  if (query.propertyId) {
    filtered = filtered.filter((t) => t.propertyIds.includes(query.propertyId!));
  }
  if (query.status) filtered = filtered.filter((t) => t.status === query.status);
  if (query.priority) filtered = filtered.filter((t) => t.priority === query.priority);
  if (query.categoryId) filtered = filtered.filter((t) => t.categoryId === query.categoryId);
  if (query.assigneeId) filtered = filtered.filter((t) => t.assigneeId === query.assigneeId);

  return { items: filtered };
});

app.get('/tasks/:id', async (request, reply) => {
  const org = (request.headers['x-org-id'] as string) ?? '';
  const { id } = request.params as { id: string };

  const [item] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, org)));
  if (!item) return reply.status(404).send({ error: 'Task not found' });
  return { item };
});

app.post('/tasks', async (request, reply) => {
  const org = (request.headers['x-org-id'] as string) ?? '';
  const user = (request.headers['x-user-id'] as string) ?? '';
  const parsed = createTaskInputSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

  const now = new Date();
  const id = randomUUID();
  const [item] = await db
    .insert(tasks)
    .values({
      id,
      organizationId: org,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: 'open',
      priority: parsed.data.priority,
      categoryId: parsed.data.categoryId ?? null,
      assigneeId: parsed.data.assigneeId ?? null,
      propertyIds: parsed.data.propertyIds,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      createdAt: now,
      createdBy: user,
      updatedAt: now,
      updatedBy: user,
    })
    .returning();

  await writeAudit(db, {
    taskId: id,
    organizationId: org,
    action: 'created',
    changedBy: user,
    delta: { title: item!.title, priority: item!.priority, propertyIds: item!.propertyIds },
  });

  return reply.status(201).send({ item });
});

app.patch('/tasks/:id', async (request, reply) => {
  const org = (request.headers['x-org-id'] as string) ?? '';
  const user = (request.headers['x-user-id'] as string) ?? '';
  const { id } = request.params as { id: string };
  const parsed = updateTaskInputSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

  const [before] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, org)));
  if (!before) return reply.status(404).send({ error: 'Task not found' });

  const updates: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date(), updatedBy: user };
  const delta: Record<string, { from: unknown; to: unknown }> = {};

  if (parsed.data.title !== undefined && parsed.data.title !== before.title) {
    updates.title = parsed.data.title;
    delta.title = { from: before.title, to: parsed.data.title };
  }
  if (parsed.data.description !== undefined && parsed.data.description !== before.description) {
    updates.description = parsed.data.description;
    delta.description = { from: before.description, to: parsed.data.description };
  }
  if (parsed.data.priority !== undefined && parsed.data.priority !== before.priority) {
    updates.priority = parsed.data.priority;
    delta.priority = { from: before.priority, to: parsed.data.priority };
  }
  if (parsed.data.categoryId !== undefined && parsed.data.categoryId !== before.categoryId) {
    updates.categoryId = parsed.data.categoryId ?? null;
    delta.categoryId = { from: before.categoryId, to: parsed.data.categoryId };
  }
  if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== before.assigneeId) {
    updates.assigneeId = parsed.data.assigneeId ?? null;
    delta.assigneeId = { from: before.assigneeId, to: parsed.data.assigneeId };
  }
  if (parsed.data.propertyIds !== undefined) {
    updates.propertyIds = parsed.data.propertyIds;
    delta.propertyIds = { from: before.propertyIds, to: parsed.data.propertyIds };
  }
  if (parsed.data.dueDate !== undefined) {
    updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    delta.dueDate = { from: before.dueDate, to: parsed.data.dueDate };
  }

  const [item] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();

  if (Object.keys(delta).length > 0) {
    await writeAudit(db, {
      taskId: id,
      organizationId: org,
      action: 'updated',
      changedBy: user,
      delta,
    });
  }

  return { item };
});

app.post('/tasks/:id/resolve', async (request, reply) => {
  const org = (request.headers['x-org-id'] as string) ?? '';
  const user = (request.headers['x-user-id'] as string) ?? '';
  const { id } = request.params as { id: string };

  const [before] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, org)));
  if (!before) return reply.status(404).send({ error: 'Task not found' });

  const now = new Date();
  const isResolving = before.status !== 'resolved';
  const newStatus = isResolving ? 'resolved' : 'open';

  const [item] = await db
    .update(tasks)
    .set({
      status: newStatus,
      resolvedAt: isResolving ? now : null,
      resolvedBy: isResolving ? user : null,
      updatedAt: now,
      updatedBy: user,
    })
    .where(eq(tasks.id, id))
    .returning();

  await writeAudit(db, {
    taskId: id,
    organizationId: org,
    action: isResolving ? 'resolved' : 'restored',
    changedBy: user,
    delta: { status: { from: before.status, to: newStatus } },
  });

  return { item };
});

app.delete('/tasks/:id', async (request, reply) => {
  const org = (request.headers['x-org-id'] as string) ?? '';
  const user = (request.headers['x-user-id'] as string) ?? '';
  const { id } = request.params as { id: string };

  const [before] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, org)));
  if (!before) return reply.status(404).send({ error: 'Task not found' });

  const now = new Date();
  const [item] = await db
    .update(tasks)
    .set({ status: 'deleted', deletedAt: now, deletedBy: user, updatedAt: now, updatedBy: user })
    .where(eq(tasks.id, id))
    .returning();

  await writeAudit(db, {
    taskId: id,
    organizationId: org,
    action: 'deleted',
    changedBy: user,
    delta: { status: { from: before.status, to: 'deleted' } },
  });

  return { item };
});
```

Also move the `writeAudit` helper outside of `buildTasksApp` (it takes `db` as a parameter).

**Step 4: Run tests to verify they all pass**

```bash
pnpm --filter @walt/service-tasks test
```

Expected: all 8 tests passing.

**Step 5: Commit**

```bash
git add services/tasks/src/
git commit -m "feat(tasks): add task CRUD routes with audit logging"
```

---

### Task 6: Register tasks service in gateway

**Files:**

- Modify: `apps/gateway/src/index.ts`

**Step 1: Add the service URL constant and proxy routes**

After `const messagingServiceBaseUrl = ...` line, add:

```typescript
const tasksServiceBaseUrl = process.env.TASKS_SERVICE_URL ?? 'http://127.0.0.1:4105';
```

Then add a helper at the top (after imports) to reduce repetition — or simply add explicit routes following the existing pattern. Add all tasks proxy routes before `const port = ...`:

```typescript
// ── Task categories ───────────────────────────────────────────────────────────

app.get(
  '/task-categories',
  { preHandler: app.requirePermission('dashboard.read') },
  async (request, reply) => {
    try {
      const response = await fetch(`${tasksServiceBaseUrl}/task-categories`, {
        headers: {
          accept: 'application/json',
          'x-org-id': request.auth?.orgId ?? '',
          'x-user-id': request.auth?.userId ?? '',
        },
      });
      if (!response.ok)
        return reply
          .status(response.status)
          .send({ error: `Tasks service returned ${response.status}` });
      return (await response.json()) as { items: unknown[] };
    } catch {
      return reply.status(502).send({ error: 'Tasks service unavailable' });
    }
  },
);

app.post(
  '/task-categories',
  { preHandler: app.requirePermission('dashboard.read') },
  async (request, reply) => {
    try {
      const response = await fetch(`${tasksServiceBaseUrl}/task-categories`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-org-id': request.auth?.orgId ?? '',
          'x-user-id': request.auth?.userId ?? '',
        },
        body: JSON.stringify(request.body ?? {}),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        return reply
          .status(response.status)
          .send({ error: payload.error ?? `Tasks service returned ${response.status}` });
      }
      return reply.status(201).send(await response.json());
    } catch {
      return reply.status(502).send({ error: 'Tasks service unavailable' });
    }
  },
);

app.patch(
  '/task-categories/:id',
  { preHandler: app.requirePermission('dashboard.read') },
  async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const response = await fetch(
        `${tasksServiceBaseUrl}/task-categories/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-org-id': request.auth?.orgId ?? '',
            'x-user-id': request.auth?.userId ?? '',
          },
          body: JSON.stringify(request.body ?? {}),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        return reply
          .status(response.status)
          .send({ error: payload.error ?? `Tasks service returned ${response.status}` });
      }
      return await response.json();
    } catch {
      return reply.status(502).send({ error: 'Tasks service unavailable' });
    }
  },
);

app.delete(
  '/task-categories/:id',
  { preHandler: app.requirePermission('dashboard.read') },
  async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const response = await fetch(
        `${tasksServiceBaseUrl}/task-categories/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: {
            accept: 'application/json',
            'x-org-id': request.auth?.orgId ?? '',
            'x-user-id': request.auth?.userId ?? '',
          },
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        return reply
          .status(response.status)
          .send({ error: payload.error ?? `Tasks service returned ${response.status}` });
      }
      return await response.json();
    } catch {
      return reply.status(502).send({ error: 'Tasks service unavailable' });
    }
  },
);

// ── Tasks ─────────────────────────────────────────────────────────────────────

app.get(
  '/tasks',
  { preHandler: app.requirePermission('dashboard.read') },
  async (request, reply) => {
    try {
      const queryParams = new URLSearchParams();
      const q = request.query as Record<string, string>;
      for (const [key, val] of Object.entries(q)) {
        if (val) queryParams.set(key, val);
      }
      const qs = queryParams.toString();
      const response = await fetch(`${tasksServiceBaseUrl}/tasks${qs ? `?${qs}` : ''}`, {
        headers: {
          accept: 'application/json',
          'x-org-id': request.auth?.orgId ?? '',
          'x-user-id': request.auth?.userId ?? '',
        },
      });
      if (!response.ok)
        return reply
          .status(response.status)
          .send({ error: `Tasks service returned ${response.status}` });
      return await response.json();
    } catch {
      return reply.status(502).send({ error: 'Tasks service unavailable' });
    }
  },
);

app.get(
  '/tasks/:id',
  { preHandler: app.requirePermission('dashboard.read') },
  async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const response = await fetch(`${tasksServiceBaseUrl}/tasks/${encodeURIComponent(id)}`, {
        headers: {
          accept: 'application/json',
          'x-org-id': request.auth?.orgId ?? '',
          'x-user-id': request.auth?.userId ?? '',
        },
      });
      if (!response.ok)
        return reply
          .status(response.status)
          .send({ error: `Tasks service returned ${response.status}` });
      return await response.json();
    } catch {
      return reply.status(502).send({ error: 'Tasks service unavailable' });
    }
  },
);

app.post(
  '/tasks',
  { preHandler: app.requirePermission('dashboard.read') },
  async (request, reply) => {
    try {
      const response = await fetch(`${tasksServiceBaseUrl}/tasks`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-org-id': request.auth?.orgId ?? '',
          'x-user-id': request.auth?.userId ?? '',
        },
        body: JSON.stringify(request.body ?? {}),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        return reply
          .status(response.status)
          .send({ error: payload.error ?? `Tasks service returned ${response.status}` });
      }
      return reply.status(201).send(await response.json());
    } catch {
      return reply.status(502).send({ error: 'Tasks service unavailable' });
    }
  },
);

app.patch(
  '/tasks/:id',
  { preHandler: app.requirePermission('dashboard.read') },
  async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const response = await fetch(`${tasksServiceBaseUrl}/tasks/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-org-id': request.auth?.orgId ?? '',
          'x-user-id': request.auth?.userId ?? '',
        },
        body: JSON.stringify(request.body ?? {}),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        return reply
          .status(response.status)
          .send({ error: payload.error ?? `Tasks service returned ${response.status}` });
      }
      return await response.json();
    } catch {
      return reply.status(502).send({ error: 'Tasks service unavailable' });
    }
  },
);

app.post(
  '/tasks/:id/resolve',
  { preHandler: app.requirePermission('dashboard.read') },
  async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const response = await fetch(
        `${tasksServiceBaseUrl}/tasks/${encodeURIComponent(id)}/resolve`,
        {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'x-org-id': request.auth?.orgId ?? '',
            'x-user-id': request.auth?.userId ?? '',
          },
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        return reply
          .status(response.status)
          .send({ error: payload.error ?? `Tasks service returned ${response.status}` });
      }
      return await response.json();
    } catch {
      return reply.status(502).send({ error: 'Tasks service unavailable' });
    }
  },
);

app.delete(
  '/tasks/:id',
  { preHandler: app.requirePermission('dashboard.read') },
  async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const response = await fetch(`${tasksServiceBaseUrl}/tasks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          accept: 'application/json',
          'x-org-id': request.auth?.orgId ?? '',
          'x-user-id': request.auth?.userId ?? '',
        },
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        return reply
          .status(response.status)
          .send({ error: payload.error ?? `Tasks service returned ${response.status}` });
      }
      return await response.json();
    } catch {
      return reply.status(502).send({ error: 'Tasks service unavailable' });
    }
  },
);
```

**Step 2: Verify typecheck**

```bash
pnpm --filter @walt/gateway typecheck
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/gateway/src/index.ts
git commit -m "feat(gateway): register tasks service proxy routes"
```

---

### Task 7: Add Next.js API proxy routes for tasks

The web API routes follow the pattern from `apps/web/src/app/api/messaging/contacts/route.ts`. They proxy to the gateway (no fallback store needed — tasks requires the DB).

**Files:**

- Create: `apps/web/src/app/api/tasks/route.ts`
- Create: `apps/web/src/app/api/tasks/[id]/route.ts`
- Create: `apps/web/src/app/api/tasks/[id]/resolve/route.ts`
- Create: `apps/web/src/app/api/task-categories/route.ts`
- Create: `apps/web/src/app/api/task-categories/[id]/route.ts`

**Step 1: Create the tasks list/create route**

Create `apps/web/src/app/api/tasks/route.ts`:

```typescript
import { NextResponse } from 'next/server';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  try {
    const response = await fetch(`${gatewayBaseUrl}/tasks${qs ? `?${qs}` : ''}`, {
      headers: {
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const response = await fetch(`${gatewayBaseUrl}/tasks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}
```

**Step 2: Create the task detail/update/delete route**

Create `apps/web/src/app/api/tasks/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const response = await fetch(`${gatewayBaseUrl}/tasks/${encodeURIComponent(id)}`, {
      headers: {
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const response = await fetch(`${gatewayBaseUrl}/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const response = await fetch(`${gatewayBaseUrl}/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}
```

**Step 3: Create the resolve route**

Create `apps/web/src/app/api/tasks/[id]/resolve/route.ts`:

```typescript
import { NextResponse } from 'next/server';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const response = await fetch(`${gatewayBaseUrl}/tasks/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}
```

**Step 4: Create category list/create route**

Create `apps/web/src/app/api/task-categories/route.ts`:

```typescript
import { NextResponse } from 'next/server';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function GET(request: Request) {
  try {
    const response = await fetch(`${gatewayBaseUrl}/task-categories`, {
      headers: {
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const response = await fetch(`${gatewayBaseUrl}/task-categories`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}
```

**Step 5: Create category update/delete route**

Create `apps/web/src/app/api/task-categories/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const response = await fetch(`${gatewayBaseUrl}/task-categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const response = await fetch(`${gatewayBaseUrl}/task-categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}
```

**Step 6: Typecheck the web app**

```bash
pnpm --filter @walt/web typecheck
```

Expected: no errors.

**Step 7: Commit**

```bash
git add apps/web/src/app/api/tasks/ apps/web/src/app/api/task-categories/
git commit -m "feat(web): add tasks and task-categories API proxy routes"
```

---

### Task 8: Build the TasksPanel React component

This is the core UI component. It is used both on the global `/tasks` page and can be embedded on a property's page (with `defaultPropertyId` pre-filtering).

**Files:**

- Create: `apps/web/src/components/tasks.tsx`

**Step 1: Create the component**

Create `apps/web/src/components/tasks.tsx`:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Priority = 'low' | 'medium' | 'high';
type TaskStatus = 'open' | 'resolved' | 'deleted';

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  categoryId?: string | null;
  assigneeId?: string | null;
  propertyIds: string[];
  dueDate?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  createdBy: string;
};

type TaskCategory = {
  id: string;
  name: string;
  color?: string | null;
};

type Property = {
  id: string;
  name: string;
};

// ── Priority UI helpers ───────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<Priority, { border: string; badge: string; label: string }> = {
  low: { border: 'border-l-yellow-400', badge: 'bg-yellow-100 text-yellow-800', label: 'Low' },
  medium: { border: 'border-l-orange-400', badge: 'bg-orange-100 text-orange-800', label: 'Medium' },
  high: { border: 'border-l-red-500', badge: 'bg-red-100 text-red-800', label: 'High' },
};

// ── Main component ────────────────────────────────────────────────────────────

export default function TasksPanel({ defaultPropertyId }: { defaultPropertyId?: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterPropertyId, setFilterPropertyId] = useState(defaultPropertyId ?? '');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCategories, setShowCategories] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<Priority>('medium');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formPropertyIds, setFormPropertyIds] = useState<string[]>(defaultPropertyId ? [defaultPropertyId] : []);
  const [formDueDate, setFormDueDate] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Category management
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#6b7280');
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterPropertyId) params.set('propertyId', filterPropertyId);
    if (filterPriority) params.set('priority', filterPriority);
    if (filterCategoryId) params.set('categoryId', filterCategoryId);
    const qs = params.toString();
    const response = await fetch(`/api/tasks${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load tasks');
    const payload = (await response.json()) as { items: Task[] };
    setTasks(payload.items);
  }, [filterPropertyId, filterPriority, filterCategoryId]);

  const fetchCategories = useCallback(async () => {
    const response = await fetch('/api/task-categories', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as { items: TaskCategory[] };
    setCategories(payload.items);
  }, []);

  const fetchProperties = useCallback(async () => {
    const response = await fetch('/api/properties', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as { items: Property[] };
    setProperties(payload.items);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTasks(), fetchCategories(), fetchProperties()])
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, [fetchTasks, fetchCategories, fetchProperties]);

  // ── Task actions ───────────────────────────────────────────────────────────

  function openCreateForm() {
    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormCategoryId('');
    setFormPropertyIds(defaultPropertyId ? [defaultPropertyId] : []);
    setFormDueDate('');
    setShowForm(true);
  }

  function openEditForm(task: Task) {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description ?? '');
    setFormPriority(task.priority);
    setFormCategoryId(task.categoryId ?? '');
    setFormPropertyIds(task.propertyIds);
    setFormDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
    setShowForm(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || formPropertyIds.length === 0) return;
    setFormSubmitting(true);
    try {
      const body = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        priority: formPriority,
        categoryId: formCategoryId || undefined,
        propertyIds: formPropertyIds,
        dueDate: formDueDate || undefined,
      };
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
      const method = editingTask ? 'PATCH' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Failed to save task');
      setShowForm(false);
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function toggleResolve(task: Task) {
    const response = await fetch(`/api/tasks/${task.id}/resolve`, { method: 'POST' });
    if (response.ok) await fetchTasks();
  }

  async function deleteTask(task: Task) {
    if (!confirm(`Delete "${task.title}"?`)) return;
    const response = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    if (response.ok) await fetchTasks();
  }

  // ── Category actions ───────────────────────────────────────────────────────

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCategorySubmitting(true);
    try {
      const response = await fetch('/api/task-categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim(), color: newCategoryColor }),
      });
      if (!response.ok) throw new Error('Failed to create category');
      setNewCategoryName('');
      await fetchCategories();
    } finally {
      setCategorySubmitting(false);
    }
  }

  async function deleteCategory(cat: TaskCategory) {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    const response = await fetch(`/api/task-categories/${cat.id}`, { method: 'DELETE' });
    if (response.ok) await fetchCategories();
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const openTasks = tasks.filter((t) => t.status === 'open' && t.deletedAt === undefined);
  const resolvedTasks = tasks.filter((t) => t.status === 'resolved');

  // ── Render helpers ─────────────────────────────────────────────────────────

  function categoryName(id: string | null | undefined) {
    return categories.find((c) => c.id === id)?.name ?? null;
  }

  function propertyName(id: string) {
    return properties.find((p) => p.id === id)?.name ?? id;
  }

  function TaskCard({ task }: { task: Task }) {
    const p = PRIORITY_STYLES[task.priority];
    const isResolved = task.status === 'resolved';
    return (
      <div
        className={`border-l-4 ${p.border} bg-white rounded-r-lg border border-l-0 border-gray-200 p-4 flex flex-col gap-2 ${isResolved ? 'opacity-60' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm ${isResolved ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {task.title}
            </p>
            {task.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>}
          </div>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${p.badge}`}>{p.label}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs text-gray-500">
          {categoryName(task.categoryId) && (
            <span className="bg-gray-100 rounded px-1.5 py-0.5">{categoryName(task.categoryId)}</span>
          )}
          {task.propertyIds.map((pid) => (
            <span key={pid} className="bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
              {propertyName(pid)}
            </span>
          ))}
          {task.dueDate && (
            <span className="text-gray-400">Due {new Date(task.dueDate).toLocaleDateString()}</span>
          )}
          {isResolved && task.resolvedAt && (
            <span className="text-green-600">Resolved {new Date(task.resolvedAt).toLocaleDateString()}</span>
          )}
        </div>

        <div className="flex gap-2 mt-1">
          <button
            onClick={() => toggleResolve(task)}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 min-h-[36px]"
          >
            {isResolved ? 'Re-open' : 'Resolve'}
          </button>
          {!isResolved && (
            <button
              onClick={() => openEditForm(task)}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 min-h-[36px]"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => deleteTask(task)}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 min-h-[36px] ml-auto"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">Loading tasks…</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500 text-sm">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCategories(true)}
              className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600 min-h-[40px]"
            >
              Categories
            </button>
            <button
              onClick={openCreateForm}
              className="text-sm px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-700 text-white font-medium min-h-[40px]"
            >
              + New Task
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {!defaultPropertyId && (
            <select
              value={filterPropertyId}
              onChange={(e) => setFilterPropertyId(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white min-h-[40px]"
            >
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white min-h-[40px]"
          >
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white min-h-[40px]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
        {openTasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
            No open tasks. Create one above.
          </div>
        )}
        {openTasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}

        {resolvedTasks.length > 0 && (
          <div>
            <button
              onClick={() => setShowResolved((v) => !v)}
              className="text-sm text-gray-400 hover:text-gray-600 py-2 flex items-center gap-1"
            >
              <span>{showResolved ? '▼' : '▶'}</span>
              <span>
                {resolvedTasks.length} resolved task{resolvedTasks.length !== 1 ? 's' : ''}
              </span>
            </button>
            {showResolved && (
              <div className="space-y-3 mt-2">
                {resolvedTasks.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold">{editingTask ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            </div>
            <form onSubmit={submitForm} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  placeholder="e.g. Fix broken lock on back gate"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  placeholder="Additional details…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority *</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormPriority(p)}
                      className={`flex-1 py-2.5 text-sm rounded-lg font-medium min-h-[44px] border-2 transition-colors ${
                        formPriority === p
                          ? `${PRIORITY_STYLES[p].badge} border-current`
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}
                    >
                      {PRIORITY_STYLES[p].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setShowCategories(true);
                  }}
                  className="text-xs text-blue-600 hover:underline mt-1"
                >
                  Manage categories
                </button>
              </div>
              {!defaultPropertyId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Properties *</label>
                  <div className="border border-gray-300 rounded-lg divide-y max-h-40 overflow-y-auto">
                    {properties.map((p) => (
                      <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={formPropertyIds.includes(p.id)}
                          onChange={(e) => {
                            setFormPropertyIds((prev) =>
                              e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                            );
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !formTitle.trim() || formPropertyIds.length === 0}
                  className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 min-h-[44px]"
                >
                  {formSubmitting ? 'Saving…' : editingTask ? 'Save changes' : 'Create task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories modal */}
      {showCategories && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold">Manage Categories</h2>
              <button onClick={() => setShowCategories(false)} className="text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {categories.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No categories yet.</p>
                )}
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3 py-2">
                    {cat.color && (
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    )}
                    <span className="text-sm flex-1">{cat.name}</span>
                    <button
                      onClick={() => deleteCategory(cat)}
                      className="text-xs text-red-500 hover:text-red-700 min-h-[36px] px-2"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={createCategory} className="border-t border-gray-200 pt-4 space-y-3">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600">Color</label>
                  <input
                    type="color"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    className="h-9 w-16 rounded border border-gray-300 cursor-pointer"
                  />
                </div>
                <button
                  type="submit"
                  disabled={categorySubmitting || !newCategoryName.trim()}
                  className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 min-h-[44px]"
                >
                  {categorySubmitting ? 'Adding…' : 'Add category'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Typecheck**

```bash
pnpm --filter @walt/web typecheck
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/web/src/components/tasks.tsx
git commit -m "feat(web): add TasksPanel mobile-first React component"
```

---

### Task 9: Add global /tasks page and nav link

**Files:**

- Create: `apps/web/src/app/tasks/page.tsx`
- Modify: `apps/web/src/lib/nav-links.ts`

**Step 1: Create the tasks page**

Create `apps/web/src/app/tasks/page.tsx`:

```typescript
import TasksPanel from '@/components/tasks';

export default function TasksPage() {
  return (
    <div className="h-full flex flex-col">
      <TasksPanel />
    </div>
  );
}
```

**Step 2: Add Tasks to nav**

In `apps/web/src/lib/nav-links.ts`, add `{ href: '/tasks', label: 'Tasks' }` after `Contacts`:

```typescript
export const navLinks = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/property-checklists', label: 'Property Checklists' },
  { href: '/reservations', label: 'Reservations' },
  { href: '/properties', label: 'Properties' },
  { href: '/questions', label: 'Questions' },
] as const;
```

**Step 3: Typecheck**

```bash
pnpm --filter @walt/web typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/web/src/app/tasks/ apps/web/src/lib/nav-links.ts
git commit -m "feat(web): add global Tasks page and nav link"
```

---

### Task 10: Add Tasks link to property cards

Add a "Tasks" quick link to each property card on the properties page so users can jump directly to that property's tasks.

**Files:**

- Modify: `apps/web/src/app/properties/page.tsx`

**Step 1: Add the Tasks link**

In `apps/web/src/app/properties/page.tsx`, inside the `<div className="mt-auto flex gap-3 ...">` block, add after the Inbox link:

```tsx
<Link
  href={`/tasks?propertyId=${p.id}`}
  className="text-gray-600 hover:text-gray-900 underline underline-offset-2"
>
  Tasks
</Link>
```

**Step 2: Typecheck**

```bash
pnpm --filter @walt/web typecheck
```

Expected: no errors.

**Step 3: Full lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: all passing.

**Step 4: Commit**

```bash
git add apps/web/src/app/properties/page.tsx
git commit -m "feat(web): add Tasks quick link to property cards"
```

---

## Environment Notes

- **Postgres:** Must be running — `docker compose -f infra/docker-compose.yml up -d`
- **Tasks service:** Start with `pnpm --filter @walt/service-tasks dev` (port 4105)
- **Gateway:** Reads `TASKS_SERVICE_URL` env var (defaults to `http://127.0.0.1:4105`)
- **All services:** `pnpm dev` from repo root runs everything via Turborepo

## Auth Notes

The gateway forwards `x-org-id` and `x-user-id` to the tasks service extracted from the validated Clerk JWT (`request.auth.orgId`, `request.auth.userId`). The web API proxy routes forward the `Authorization` header from the browser request to the gateway. This is sufficient for the initial implementation; further hardening (e.g., verifying the token at the service level) is future work.
