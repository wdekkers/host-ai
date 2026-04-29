import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { tasks, taskCategories, taskAuditEvents } from '@walt/db';
import { createTaskInputSchema } from '@walt/contracts';
import type { Db } from './index.js';

// Outer envelope schema — validates structure but defers per-draft validation to the loop
const bulkEnvelopeSchema = z.object({
  drafts: z.array(z.unknown()).min(1),
  source: z.enum(['ai-dictation', 'manual']).default('manual'),
});

// Per-draft extended schema including optional newCategoryName
const draftSchema = createTaskInputSchema.extend({
  newCategoryName: z.string().min(1).optional(),
});

export function registerBulkCreateRoute(app: FastifyInstance, db: Db): void {
  app.post('/tasks/bulk', async (request, reply) => {
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const user = request.headers['x-user-id'] as string | undefined;
    if (!user) return reply.status(400).send({ error: 'Missing x-user-id header' });

    const parsed = bulkEnvelopeSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

    const results: Array<{ ok: boolean; task?: unknown; error?: string }> = [];

    for (const rawDraft of parsed.data.drafts) {
      try {
        const draft = draftSchema.parse(rawDraft);
        const { newCategoryName, ...taskInput } = draft;
        const validated = createTaskInputSchema.parse(taskInput);

        let categoryId = validated.categoryId ?? null;
        if (!categoryId && newCategoryName) {
          const trimmed = newCategoryName.trim();
          const existing = await db
            .select({ id: taskCategories.id })
            .from(taskCategories)
            .where(
              and(
                eq(taskCategories.organizationId, org),
                sql`lower(${taskCategories.name}) = lower(${trimmed})`,
              ),
            )
            .limit(1);
          if (existing[0]) {
            categoryId = existing[0].id;
          } else {
            const newId = randomUUID();
            await db.insert(taskCategories).values({
              id: newId,
              organizationId: org,
              name: trimmed,
              createdAt: new Date(),
              createdBy: user,
            });
            categoryId = newId;
          }
        }

        const id = randomUUID();
        const now = new Date();
        const [item] = await db
          .insert(tasks)
          .values({
            id,
            organizationId: org,
            title: validated.title,
            description: validated.description ?? null,
            status: 'open',
            priority: validated.priority,
            categoryId,
            assigneeId: validated.assigneeId ?? null,
            propertyIds: validated.propertyIds,
            dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
            createdAt: now,
            createdBy: user,
            updatedAt: now,
            updatedBy: user,
          })
          .returning();

        await db.insert(taskAuditEvents).values({
          id: randomUUID(),
          taskId: id,
          organizationId: org,
          action: 'created',
          changedBy: user,
          changedAt: now,
          delta: {
            source: parsed.data.source,
            title: validated.title,
            priority: validated.priority,
            propertyIds: validated.propertyIds,
          },
        });

        results.push({ ok: true, task: item });
      } catch (err) {
        results.push({ ok: false, error: (err as Error).message });
      }
    }

    return reply.status(200).send({ results });
  });
}
