import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serviceHealthResponseSchema } from '@walt/contracts';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { authPlugin } from './plugins/auth.js';
import { authorizePlugin } from './plugins/authorize.js';

const app = Fastify({ logger: true });
const messagingServiceBaseUrl = process.env.MESSAGING_SERVICE_URL ?? 'http://127.0.0.1:4102';

await app.register(swagger, {
  openapi: {
    info: {
      title: 'Walt Gateway API',
      version: '0.1.0',
    },
  },
});

await app.register(swaggerUi, { routePrefix: '/docs' });
await app.register(authPlugin);
await app.register(authorizePlugin);

app.get(
  '/health',
  {
    schema: {
      tags: ['system'],
      response: {
        200: zodToJsonSchema(serviceHealthResponseSchema, 'ServiceHealthResponse'),
      },
    },
  },
  async () => ({ status: 'ok', service: 'gateway' }),
);

app.get(
  '/me',
  {
    preHandler: app.requirePermission('dashboard.read'),
  },
  async (request) => ({
    userId: request.auth?.userId,
    orgId: request.auth?.orgId,
    role: request.auth?.role,
  }),
);

app.get('/messaging/contacts', async (_request, reply) => {
  try {
    const response = await fetch(`${messagingServiceBaseUrl}/contacts`);
    if (!response.ok) {
      return reply.status(response.status).send({ error: `Messaging service returned ${response.status}` });
    }

    const payload = (await response.json()) as { items: unknown[] };
    return { items: payload.items ?? [] };
  } catch (error) {
    app.log.error({ error }, 'Failed to load contacts from messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});

app.post('/messaging/contacts', async (request, reply) => {
  try {
    const response = await fetch(`${messagingServiceBaseUrl}/contacts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(request.body ?? {})
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return reply.status(response.status).send({ error: payload.error ?? `Messaging service returned ${response.status}` });
    }

    const payload = (await response.json()) as { item: unknown };
    return reply.status(201).send({ item: payload.item });
  } catch (error) {
    app.log.error({ error }, 'Failed to create contact in messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});

app.get('/messaging/messages', async (request, reply) => {
  try {
    const { contactId } = request.query as { contactId?: string };
    const query = contactId ? `?contactId=${encodeURIComponent(contactId)}` : '';
    const response = await fetch(`${messagingServiceBaseUrl}/messages${query}`);
    if (!response.ok) {
      return reply.status(response.status).send({ error: `Messaging service returned ${response.status}` });
    }

    const payload = (await response.json()) as { items: unknown[] };
    return { items: payload.items ?? [] };
  } catch (error) {
    app.log.error({ error }, 'Failed to load messages from messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});

app.post('/messaging/messages', async (request, reply) => {
  try {
    const response = await fetch(`${messagingServiceBaseUrl}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(request.body ?? {})
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return reply.status(response.status).send({ error: payload.error ?? `Messaging service returned ${response.status}` });
    }

    const payload = (await response.json()) as { item: unknown };
    return reply.status(201).send({ item: payload.item });
  } catch (error) {
    app.log.error({ error }, 'Failed to create message in messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
