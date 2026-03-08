import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMessagingApp } from './index.js';

void test('GET /contacts returns a contact list', async () => {
  const app = buildMessagingApp();
  const response = await app.inject({ method: 'GET', url: '/contacts' });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    items: Array<{ id: string; displayName: string; contactType: string; preferred: boolean }>;
  };

  assert.ok(payload.items.length > 0);
  assert.equal(payload.items[0]?.id, 'contact-001');
  assert.equal(payload.items[0]?.preferred, true);
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

void test('POST /contacts creates a contact with free-text contactType', async () => {
  const app = buildMessagingApp();
  const createResponse = await app.inject({
    method: 'POST',
    url: '/contacts',
    payload: {
      displayName: 'Apex Pool Co',
      contactType: 'pool-specialist-night-shift',
      channel: 'sms',
      handle: '+1-555-0202'
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as {
    item: { id: string; displayName: string; contactType: string; channel: string; handle: string };
  };
  assert.equal(created.item.displayName, 'Apex Pool Co');
  assert.equal(created.item.contactType, 'pool-specialist-night-shift');

  const listResponse = await app.inject({ method: 'GET', url: '/contacts' });
  const listPayload = listResponse.json() as { items: Array<{ id: string }> };
  assert.ok(listPayload.items.some((item) => item.id === created.item.id));
  await app.close();
});

void test('PATCH /contacts/:id marks preferred contact', async () => {
  const app = buildMessagingApp();
  const patchResponse = await app.inject({
    method: 'PATCH',
    url: '/contacts/contact-002',
    payload: { preferred: true }
  });

  assert.equal(patchResponse.statusCode, 200);

  const listResponse = await app.inject({ method: 'GET', url: '/contacts' });
  const payload = listResponse.json() as { items: Array<{ id: string; preferred: boolean }> };
  assert.equal(payload.items.find((item) => item.id === 'contact-002')?.preferred, true);
  assert.equal(payload.items.find((item) => item.id === 'contact-001')?.preferred, false);
  await app.close();
});

void test('POST /messages appends a conversation message for selected contact', async () => {
  const app = buildMessagingApp();
  const response = await app.inject({
    method: 'POST',
    url: '/messages',
    payload: {
      contactId: 'contact-001',
      direction: 'outbound',
      body: 'Pool vendor please confirm ETA for repair.'
    }
  });

  assert.equal(response.statusCode, 201);
  const created = response.json() as { item: { contactId: string; body: string; direction: 'inbound' | 'outbound' } };
  assert.equal(created.item.contactId, 'contact-001');
  assert.equal(created.item.direction, 'outbound');

  const messagesResponse = await app.inject({ method: 'GET', url: '/messages?contactId=contact-001' });
  const payload = messagesResponse.json() as { items: Array<{ body: string }> };
  assert.ok(payload.items.some((message) => message.body === 'Pool vendor please confirm ETA for repair.'));
  await app.close();
});
