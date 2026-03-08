import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { z } from 'zod';

type Contact = {
  id: string;
  displayName: string;
  contactType: string;
  channel: 'sms' | 'airbnb' | 'email';
  handle: string;
  preferred: boolean;
  lastMessageAt: string;
};

type Message = {
  id: string;
  contactId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sentAt: string;
};

const contacts: Contact[] = [
  {
    id: 'contact-001',
    displayName: 'Blue Wave Pools',
    contactType: 'pool-maintenance',
    channel: 'sms',
    handle: '+1-555-0101',
    preferred: true,
    lastMessageAt: '2026-03-08T11:00:00.000Z'
  },
  {
    id: 'contact-002',
    displayName: 'Rapid Rooter',
    contactType: 'plumber',
    channel: 'sms',
    handle: '+1-555-0132',
    preferred: false,
    lastMessageAt: '2026-03-08T09:30:00.000Z'
  }
];

const messages: Message[] = [
  {
    id: 'message-001',
    contactId: 'contact-001',
    direction: 'inbound',
    body: 'Pool light is flickering. Can we check it today?',
    sentAt: '2026-03-08T10:30:00.000Z'
  },
  {
    id: 'message-002',
    contactId: 'contact-001',
    direction: 'outbound',
    body: 'Yes, please stop by after 2 PM and send an ETA.',
    sentAt: '2026-03-08T11:00:00.000Z'
  },
  {
    id: 'message-003',
    contactId: 'contact-002',
    direction: 'inbound',
    body: 'Leak under kitchen sink fixed and tested.',
    sentAt: '2026-03-08T09:30:00.000Z'
  }
];

const defaultPortByService: Record<string, number> = {
  identity: 4101,
  messaging: 4102,
  ops: 4103,
  notifications: 4104
};

const createContactInputSchema = z.object({
  displayName: z.string().min(1),
  contactType: z.string().min(1),
  channel: z.enum(['sms', 'airbnb', 'email']),
  handle: z.string().min(1),
  preferred: z.boolean().optional()
});

const updateContactInputSchema = z.object({
  preferred: z.boolean()
});

const createMessageInputSchema = z.object({
  contactId: z.string().min(1),
  direction: z.enum(['inbound', 'outbound']),
  body: z.string().min(1)
});

const sortContacts = (items: Contact[]) =>
  [...items].sort((left, right) => Number(right.preferred) - Number(left.preferred) || right.lastMessageAt.localeCompare(left.lastMessageAt));

export function buildMessagingApp() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok', service: 'messaging' }));
  app.get('/contacts', async () => ({ items: sortContacts(contacts) }));
  app.get('/messages', async (request) => {
    const { contactId } = request.query as { contactId?: string };
    const filtered = contactId ? messages.filter((message) => message.contactId === contactId) : messages;
    return { items: [...filtered].sort((a, b) => b.sentAt.localeCompare(a.sentAt)) };
  });

  app.post('/contacts', async (request, reply) => {
    const parsed = createContactInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    if (parsed.data.preferred) {
      for (const contact of contacts) {
        contact.preferred = false;
      }
    }

    const now = new Date().toISOString();
    const item: Contact = {
      id: `contact-${String(contacts.length + 1).padStart(3, '0')}`,
      displayName: parsed.data.displayName,
      contactType: parsed.data.contactType,
      channel: parsed.data.channel,
      handle: parsed.data.handle,
      preferred: Boolean(parsed.data.preferred),
      lastMessageAt: now
    };
    contacts.unshift(item);
    return reply.status(201).send({ item });
  });

  app.patch('/contacts/:id', async (request, reply) => {
    const parsed = updateContactInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const { id } = request.params as { id: string };
    const existing = contacts.find((contact) => contact.id === id);
    if (!existing) {
      return reply.status(404).send({ error: 'Contact not found' });
    }

    if (parsed.data.preferred) {
      for (const contact of contacts) {
        contact.preferred = contact.id === id;
      }
    } else {
      existing.preferred = false;
    }

    return { item: existing };
  });

  app.post('/messages', async (request, reply) => {
    const parsed = createMessageInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const target = contacts.find((contact) => contact.id === parsed.data.contactId);
    if (!target) {
      return reply.status(404).send({ error: 'Contact not found' });
    }

    const sentAt = new Date().toISOString();
    const item: Message = {
      id: `message-${String(messages.length + 1).padStart(3, '0')}`,
      contactId: parsed.data.contactId,
      direction: parsed.data.direction,
      body: parsed.data.body,
      sentAt
    };
    messages.push(item);
    target.lastMessageAt = sentAt;
    return reply.status(201).send({ item });
  });

  return app;
}

export async function startMessagingServer() {
  const app = buildMessagingApp();
  const port = Number(process.env.PORT ?? defaultPortByService['messaging']);
  await app.listen({ port, host: '0.0.0.0' });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await startMessagingServer();
}
