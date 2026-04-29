import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { taskCategories } from '@walt/db';
import { parseTaskDictationInputSchema } from '@walt/contracts';
import { parseTaskDictationWithOpenAi as defaultParse } from '@walt/ai';
import { loadPropertyContext } from './property-context.js';
import type { Db, TasksAppDeps } from './index.js';

export function registerParseDictationRoute(
  app: FastifyInstance,
  db: Db,
  deps: TasksAppDeps,
): void {
  const parse = deps.parseTaskDictation ?? defaultParse;

  app.post('/tasks/parse-dictation', async (request, reply) => {
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const user = request.headers['x-user-id'] as string | undefined;
    if (!user) return reply.status(400).send({ error: 'Missing x-user-id header' });

    const input = parseTaskDictationInputSchema.safeParse(request.body);
    if (!input.success) return reply.status(400).send({ error: input.error.message });

    const propertiesCtx = await loadPropertyContext(db);
    const categories = await db
      .select({ id: taskCategories.id, name: taskCategories.name })
      .from(taskCategories)
      .where(eq(taskCategories.organizationId, org));

    try {
      const result = await parse({
        transcript: input.data.transcript,
        today: new Date().toISOString().slice(0, 10),
        properties: propertiesCtx,
        categories,
      });

      const validPropertyIds = new Set(propertiesCtx.map((p) => p.id));
      const validCategoryIds = new Set(categories.map((c) => c.id));
      const sanitized = result.tasks.map((t) => {
        const matchedProps = t.propertyMatches.filter((id) => validPropertyIds.has(id));
        const droppedAny = matchedProps.length !== t.propertyMatches.length;
        return {
          ...t,
          propertyMatches: matchedProps,
          propertyAmbiguous:
            droppedAny && !t.propertyAmbiguous
              ? '(model returned unknown property)'
              : t.propertyAmbiguous,
          categoryId:
            t.categoryId && validCategoryIds.has(t.categoryId) ? t.categoryId : null,
          suggestedNewCategory:
            t.categoryId && !validCategoryIds.has(t.categoryId) && !t.suggestedNewCategory
              ? null
              : t.suggestedNewCategory,
        };
      });

      return reply.status(200).send({ tasks: sanitized });
    } catch (err) {
      app.log.warn({ err }, 'parseTaskDictation failed');
      return reply.status(422).send({ error: (err as Error).message });
    }
  });
}
