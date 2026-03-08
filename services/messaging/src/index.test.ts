import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMessagingApp } from './index.js';

void test('GET /contacts returns a contact list', async () => {
  const app = buildMessagingApp();
  const response = await app.inject({ method: 'GET', url: '/contacts' });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    items: Array<{ id: string; displayName: string; channel: string; handle: string; lastMessageAt: string }>;
  };

  assert.ok(payload.items.length > 0);
  assert.equal(payload.items[0]?.id, 'contact-001');
  await app.close();
});

void test('GET /messages filters by contactId', async () => {
  const app = buildMessagingApp();
  const response = await app.inject({ method: 'GET', url: '/messages?contactId=contact-001' });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    items: Array<{ id: string; contactId: string; direction: 'inbound' | 'outbound'; body: string; sentAt: string }>;
  };

  assert.ok(payload.items.length > 0);
  assert.ok(payload.items.every((message) => message.contactId === 'contact-001'));
  await app.close();
});
