import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { createDb, taskCategories } from '@walt/db';
import { createTaskCategoryInputSchema, updateTaskCategoryInputSchema } from '@walt/contracts';

type Db = ReturnType<typeof createDb>;

export function buildTasksApp(db: Db) {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok', service: 'tasks' }));

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
      .where(and(eq(taskCategories.id, id), eq(taskCategories.organizationId, org)))
      .returning();
    if (!item) return reply.status(404).send({ error: 'Category not found' });
    return { item };
  });

  app.delete('/task-categories/:id', async (request, reply) => {
    const org = (request.headers['x-org-id'] as string) ?? '';
    const { id } = request.params as { id: string };

    const [item] = await db
      .update(taskCategories)
      .set({ deletedAt: new Date() })
      .where(and(eq(taskCategories.id, id), eq(taskCategories.organizationId, org)))
      .returning();
    if (!item) return reply.status(404).send({ error: 'Category not found' });
    return { item };
  });

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
