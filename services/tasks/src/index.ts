import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { createDb } from '@walt/db';

type Db = ReturnType<typeof createDb>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildTasksApp(_db: Db) {
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
