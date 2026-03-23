import Fastify from "fastify";
import { sql } from "drizzle-orm";
import { db } from "./db.js";
import { registerBookingsRoutes } from "./routes/bookings.js";
import { registerWebhooksRoutes } from "./routes/webhooks.js";

import type { FastifyInstance } from "fastify";

export const buildServer = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: true });

  app.get("/", async () => ({ status: "ok" }));
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ready", async (_request, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: "ready" };
    } catch (error) {
      app.log.error({ error }, "Database not ready");
      return reply.code(503).send({ status: "not_ready" });
    }
  });

  app.get("/v1/ping", async () => ({ status: "ok" }));

  await registerBookingsRoutes(app);
  await registerWebhooksRoutes(app);

  return app;
};
