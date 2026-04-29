import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { createDb, taskCategories, tasks, taskAuditEvents } from '@walt/db';
import {
  createTaskCategoryInputSchema,
  updateTaskCategoryInputSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
} from '@walt/contracts';
import type { TaskAuditAction } from '@walt/contracts';
import type { parseTaskDictationWithOpenAi } from '@walt/ai';
import { registerParseDictationRoute } from './parse-dictation.js';
import { registerBulkCreateRoute } from './bulk.js';

export type Db = ReturnType<typeof createDb>;

export type TasksAppDeps = {
  parseTaskDictation?: typeof parseTaskDictationWithOpenAi;
};

async function writeAudit(
  db: Db,
  opts: {
    taskId: string;
    organizationId: string;
    action: TaskAuditAction;
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

export { loadPropertyContext } from './property-context.js';

export function buildTasksApp(db: Db, deps: TasksAppDeps = {}) {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok', service: 'tasks' }));

  // ── Categories ────────────────────────────────────────────────────────────────

  app.get('/task-categories', async (request, reply) => {
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const rows = await db
      .select()
      .from(taskCategories)
      .where(and(eq(taskCategories.organizationId, org), isNull(taskCategories.deletedAt)));
    return { items: rows };
  });

  app.post('/task-categories', async (request, reply) => {
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const user = request.headers['x-user-id'] as string | undefined;
    if (!user) return reply.status(400).send({ error: 'Missing x-user-id header' });
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
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const { id } = request.params as { id: string };
    const parsed = updateTaskCategoryInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

    const updates: Partial<{ name: string; color: string | null }> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.color !== undefined) updates.color = parsed.data.color ?? null;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const [item] = await db
      .update(taskCategories)
      .set(updates)
      .where(
        and(
          eq(taskCategories.id, id),
          eq(taskCategories.organizationId, org),
          isNull(taskCategories.deletedAt),
        ),
      )
      .returning();
    if (!item) return reply.status(404).send({ error: 'Category not found' });
    return { item };
  });

  app.delete('/task-categories/:id', async (request, reply) => {
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const { id } = request.params as { id: string };

    const [item] = await db
      .update(taskCategories)
      .set({ deletedAt: new Date() })
      .where(and(eq(taskCategories.id, id), eq(taskCategories.organizationId, org)))
      .returning();
    if (!item) return reply.status(404).send({ error: 'Category not found' });
    return { item };
  });

  // ── Tasks ─────────────────────────────────────────────────────────────────────

  app.get('/tasks', async (request, reply) => {
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });

    const query = request.query as {
      propertyId?: string;
      status?: string;
      priority?: string;
      categoryId?: string;
      assigneeId?: string;
      includeDeleted?: string;
    };

    const conditions = [eq(tasks.organizationId, org)];

    if (query.includeDeleted !== 'true') {
      conditions.push(isNull(tasks.deletedAt));
    }
    if (query.status) conditions.push(eq(tasks.status, query.status));
    if (query.priority) conditions.push(eq(tasks.priority, query.priority));
    if (query.categoryId) conditions.push(eq(tasks.categoryId, query.categoryId));
    if (query.assigneeId) conditions.push(eq(tasks.assigneeId, query.assigneeId));
    if (query.propertyId) {
      conditions.push(sql`${tasks.propertyIds} @> ARRAY[${query.propertyId}]::text[]`);
    }

    const items = await db
      .select()
      .from(tasks)
      .where(and(...conditions));

    return { items };
  });

  app.get('/tasks/:id', async (request, reply) => {
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const { id } = request.params as { id: string };

    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, org), isNull(tasks.deletedAt)));
    const item = rows[0];
    if (!item) return reply.status(404).send({ error: 'Task not found' });
    return { item };
  });

  app.post('/tasks', async (request, reply) => {
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const user = request.headers['x-user-id'] as string | undefined;
    if (!user) return reply.status(400).send({ error: 'Missing x-user-id header' });

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
      delta: {
        title: parsed.data.title,
        priority: parsed.data.priority,
        propertyIds: parsed.data.propertyIds,
      },
    });

    return reply.status(201).send({ item });
  });

  app.patch('/tasks/:id', async (request, reply) => {
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const user = request.headers['x-user-id'] as string | undefined;
    if (!user) return reply.status(400).send({ error: 'Missing x-user-id header' });
    const { id } = request.params as { id: string };

    const parsed = updateTaskInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

    const beforeRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, org), isNull(tasks.deletedAt)));
    const before = beforeRows[0];
    if (!before) return reply.status(404).send({ error: 'Task not found' });

    const updates: Partial<typeof tasks.$inferInsert> = {
      updatedAt: new Date(),
      updatedBy: user,
    };
    const delta: Record<string, unknown> = {};

    if (parsed.data.title !== undefined && parsed.data.title !== before.title) {
      updates.title = parsed.data.title;
      delta.title = { from: before.title, to: parsed.data.title };
    }
    if (parsed.data.description !== undefined && parsed.data.description !== before.description) {
      updates.description = parsed.data.description ?? null;
      delta.description = { from: before.description, to: parsed.data.description ?? null };
    }
    if (parsed.data.priority !== undefined && parsed.data.priority !== before.priority) {
      updates.priority = parsed.data.priority;
      delta.priority = { from: before.priority, to: parsed.data.priority };
    }
    if (parsed.data.categoryId !== undefined && parsed.data.categoryId !== before.categoryId) {
      updates.categoryId = parsed.data.categoryId ?? null;
      delta.categoryId = { from: before.categoryId, to: parsed.data.categoryId ?? null };
    }
    if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== before.assigneeId) {
      updates.assigneeId = parsed.data.assigneeId ?? null;
      delta.assigneeId = { from: before.assigneeId, to: parsed.data.assigneeId ?? null };
    }
    if (parsed.data.propertyIds !== undefined) {
      updates.propertyIds = parsed.data.propertyIds;
      delta.propertyIds = { from: before.propertyIds, to: parsed.data.propertyIds };
    }
    if (parsed.data.dueDate !== undefined) {
      const newDueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
      updates.dueDate = newDueDate;
      delta.dueDate = { from: before.dueDate, to: newDueDate };
    }

    const [item] = await db
      .update(tasks)
      .set(updates)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, org)))
      .returning();

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
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const user = request.headers['x-user-id'] as string | undefined;
    if (!user) return reply.status(400).send({ error: 'Missing x-user-id header' });
    const { id } = request.params as { id: string };

    const beforeRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, org)));
    const before = beforeRows[0];
    if (!before) return reply.status(404).send({ error: 'Task not found' });

    const now = new Date();
    let updates: Partial<typeof tasks.$inferInsert>;
    let action: TaskAuditAction;

    if (before.status === 'resolved') {
      // Toggle back to open (restore)
      updates = {
        status: 'open',
        resolvedAt: null,
        resolvedBy: null,
        updatedAt: now,
        updatedBy: user,
      };
      action = 'restored';
    } else {
      // Mark as resolved
      updates = {
        status: 'resolved',
        resolvedAt: now,
        resolvedBy: user,
        updatedAt: now,
        updatedBy: user,
      };
      action = 'resolved';
    }

    const [item] = await db
      .update(tasks)
      .set(updates)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, org)))
      .returning();

    await writeAudit(db, {
      taskId: id,
      organizationId: org,
      action,
      changedBy: user,
      delta: { status: { from: before.status, to: updates.status } },
    });

    return { item };
  });

  app.delete('/tasks/:id', async (request, reply) => {
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const user = request.headers['x-user-id'] as string | undefined;
    if (!user) return reply.status(400).send({ error: 'Missing x-user-id header' });
    const { id } = request.params as { id: string };

    const beforeRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, org)));
    if (!beforeRows[0]) return reply.status(404).send({ error: 'Task not found' });

    const now = new Date();
    const [item] = await db
      .update(tasks)
      .set({
        status: 'deleted',
        deletedAt: now,
        deletedBy: user,
        updatedAt: now,
        updatedBy: user,
      })
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, org)))
      .returning();

    await writeAudit(db, {
      taskId: id,
      organizationId: org,
      action: 'deleted',
      changedBy: user,
      delta: { status: { from: beforeRows[0].status, to: 'deleted' } },
    });

    return { item };
  });

  registerParseDictationRoute(app, db, deps);
  registerBulkCreateRoute(app, db);

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
