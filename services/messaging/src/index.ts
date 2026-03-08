import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';

type Contact = {
  id: string;
  displayName: string;
  channel: 'sms' | 'airbnb' | 'email';
  handle: string;
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
    displayName: 'Taylor Reed',
    channel: 'sms',
    handle: '+1-555-0101',
    lastMessageAt: '2026-03-08T11:00:00.000Z'
  },
  {
    id: 'contact-002',
    displayName: 'Jordan Lee',
    channel: 'airbnb',
    handle: 'airbnb:guest-202',
    lastMessageAt: '2026-03-08T09:30:00.000Z'
  }
];

const messages: Message[] = [
  {
    id: 'message-001',
    contactId: 'contact-001',
    direction: 'inbound',
    body: 'Can we check in around 2pm?',
    sentAt: '2026-03-08T10:30:00.000Z'
  },
  {
    id: 'message-002',
    contactId: 'contact-001',
    direction: 'outbound',
    body: 'Yes, early check-in is available after 2pm.',
    sentAt: '2026-03-08T11:00:00.000Z'
  },
  {
    id: 'message-003',
    contactId: 'contact-002',
    direction: 'inbound',
    body: 'Do you have parking instructions?',
    sentAt: '2026-03-08T09:30:00.000Z'
  }
];

const defaultPortByService: Record<string, number> = {
  identity: 4101,
  messaging: 4102,
  ops: 4103,
  notifications: 4104,
};

export function buildMessagingApp() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok', service: 'messaging' }));
  app.get('/contacts', async () => ({ items: [...contacts].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)) }));
  app.get('/messages', async (request) => {
    const { contactId } = request.query as { contactId?: string };
    const filtered = contactId ? messages.filter((message) => message.contactId === contactId) : messages;
    return { items: [...filtered].sort((a, b) => b.sentAt.localeCompare(a.sentAt)) };
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
