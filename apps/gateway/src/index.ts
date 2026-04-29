import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serviceHealthResponseSchema } from '@walt/contracts';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { registerAuthHook } from './plugins/auth.js';
import { requireAuth } from './plugins/authorize.js';

const app = Fastify({ logger: true });
const messagingServiceBaseUrl = process.env.MESSAGING_SERVICE_URL ?? 'http://127.0.0.1:4102';
const tasksServiceBaseUrl = process.env.TASKS_SERVICE_URL ?? 'http://127.0.0.1:4105';

await app.register(swagger, {
  openapi: {
    info: {
      title: 'Walt Gateway API',
      version: '0.1.0',
    },
  },
});

await app.register(swaggerUi, { routePrefix: '/docs' });
await registerAuthHook(app);

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
    preHandler: requireAuth(),
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
      return reply
        .status(response.status)
        .send({ error: `Messaging service returned ${response.status}` });
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
      body: JSON.stringify(request.body ?? {}),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return reply
        .status(response.status)
        .send({ error: payload.error ?? `Messaging service returned ${response.status}` });
    }

    const payload = (await response.json()) as { item: unknown };
    return reply.status(201).send({ item: payload.item });
  } catch (error) {
    app.log.error({ error }, 'Failed to create contact in messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});

app.patch('/messaging/contacts/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const response = await fetch(`${messagingServiceBaseUrl}/contacts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(request.body ?? {}),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return reply
        .status(response.status)
        .send({ error: payload.error ?? `Messaging service returned ${response.status}` });
    }

    const payload = (await response.json()) as { item: unknown };
    return { item: payload.item };
  } catch (error) {
    app.log.error({ error }, 'Failed to update contact in messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});

app.get('/messaging/messages', async (request, reply) => {
  try {
    const { contactId } = request.query as { contactId?: string };
    const query = contactId ? `?contactId=${encodeURIComponent(contactId)}` : '';
    const response = await fetch(`${messagingServiceBaseUrl}/messages${query}`);
    if (!response.ok) {
      return reply
        .status(response.status)
        .send({ error: `Messaging service returned ${response.status}` });
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
      body: JSON.stringify(request.body ?? {}),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return reply
        .status(response.status)
        .send({ error: payload.error ?? `Messaging service returned ${response.status}` });
    }

    const payload = (await response.json()) as { item: unknown };
    return reply.status(201).send({ item: payload.item });
  } catch (error) {
    app.log.error({ error }, 'Failed to create message in messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});

app.get('/task-categories', { preHandler: requireAuth() }, async (request, reply) => {
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
  } catch (error) {
    app.log.error({ error }, 'Failed to load task categories from tasks service');
    return reply.status(502).send({ error: 'Tasks service unavailable' });
  }
});

app.post('/task-categories', { preHandler: requireAuth() }, async (request, reply) => {
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
  } catch (error) {
    app.log.error({ error }, 'Failed to create task category in tasks service');
    return reply.status(502).send({ error: 'Tasks service unavailable' });
  }
});

app.patch('/task-categories/:id', { preHandler: requireAuth() }, async (request, reply) => {
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
  } catch (error) {
    app.log.error({ error }, 'Failed to update task category in tasks service');
    return reply.status(502).send({ error: 'Tasks service unavailable' });
  }
});

app.delete('/task-categories/:id', { preHandler: requireAuth() }, async (request, reply) => {
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
  } catch (error) {
    app.log.error({ error }, 'Failed to delete task category in tasks service');
    return reply.status(502).send({ error: 'Tasks service unavailable' });
  }
});

app.get('/tasks', { preHandler: requireAuth() }, async (request, reply) => {
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
  } catch (error) {
    app.log.error({ error }, 'Failed to load tasks from tasks service');
    return reply.status(502).send({ error: 'Tasks service unavailable' });
  }
});

app.get('/tasks/:id', { preHandler: requireAuth() }, async (request, reply) => {
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
  } catch (error) {
    app.log.error({ error }, 'Failed to load task from tasks service');
    return reply.status(502).send({ error: 'Tasks service unavailable' });
  }
});

app.post('/tasks', { preHandler: requireAuth() }, async (request, reply) => {
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
  } catch (error) {
    app.log.error({ error }, 'Failed to create task in tasks service');
    return reply.status(502).send({ error: 'Tasks service unavailable' });
  }
});

app.post('/tasks/parse-dictation', { preHandler: requireAuth() }, async (request, reply) => {
  try {
    const response = await fetch(`${tasksServiceBaseUrl}/tasks/parse-dictation`, {
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
    return reply.status(response.status).send(await response.json());
  } catch (error) {
    app.log.error({ error }, 'Failed to parse dictation in tasks service');
    return reply.status(502).send({ error: 'Tasks service unavailable' });
  }
});

app.post('/tasks/bulk', { preHandler: requireAuth() }, async (request, reply) => {
  try {
    const response = await fetch(`${tasksServiceBaseUrl}/tasks/bulk`, {
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
    return reply.status(response.status).send(await response.json());
  } catch (error) {
    app.log.error({ error }, 'Failed to bulk create tasks in tasks service');
    return reply.status(502).send({ error: 'Tasks service unavailable' });
  }
});

app.patch('/tasks/:id', { preHandler: requireAuth() }, async (request, reply) => {
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
  } catch (error) {
    app.log.error({ error }, 'Failed to update task in tasks service');
    return reply.status(502).send({ error: 'Tasks service unavailable' });
  }
});

app.post('/tasks/:id/resolve', { preHandler: requireAuth() }, async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const response = await fetch(`${tasksServiceBaseUrl}/tasks/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
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
  } catch (error) {
    app.log.error({ error }, 'Failed to resolve task in tasks service');
    return reply.status(502).send({ error: 'Tasks service unavailable' });
  }
});

app.delete('/tasks/:id', { preHandler: requireAuth() }, async (request, reply) => {
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
  } catch (error) {
    app.log.error({ error }, 'Failed to delete task in tasks service');
    return reply.status(502).send({ error: 'Tasks service unavailable' });
  }
});

// Vendor admin routes — proxied to messaging service
app.get('/vendors', async (_request, reply) => {
  try {
    const response = await fetch(`${messagingServiceBaseUrl}/vendors`);
    if (!response.ok) {
      return reply
        .status(response.status)
        .send({ error: `Messaging service returned ${response.status}` });
    }
    return reply.send(await response.json());
  } catch (error) {
    app.log.error({ error }, 'Failed to load vendors from messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});

app.get('/vendors/:id/history', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const response = await fetch(`${messagingServiceBaseUrl}/vendors/${id}/history`);
    if (!response.ok) {
      return reply
        .status(response.status)
        .send({ error: `Messaging service returned ${response.status}` });
    }
    return reply.send(await response.json());
  } catch (error) {
    app.log.error({ error }, 'Failed to load vendor history from messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});

app.patch('/vendors/:id/disable', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const response = await fetch(`${messagingServiceBaseUrl}/vendors/${id}/disable`, {
      method: 'PATCH',
    });
    if (!response.ok) {
      return reply
        .status(response.status)
        .send({ error: `Messaging service returned ${response.status}` });
    }
    return reply.send(await response.json());
  } catch (error) {
    app.log.error({ error }, 'Failed to disable vendor in messaging service');
    return reply.status(502).send({ error: 'Messaging service unavailable' });
  }
});

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
