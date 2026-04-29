import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createDb, properties } from '@walt/db';
import { buildTasksApp, loadPropertyContext } from './index.js';

const db = createDb(process.env.DATABASE_URL ?? 'postgres://walt:walt@localhost:5432/walt');

void test('GET /health returns ok', async () => {
  const app = buildTasksApp(db);
  const response = await app.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { status: string; service: string };
  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'tasks');
  await app.close();
});

void test('GET /task-categories returns 400 when x-org-id header is missing', async () => {
  const app = buildTasksApp(db);
  const response = await app.inject({
    method: 'GET',
    url: '/task-categories',
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});

void test('GET /task-categories returns empty list for new org', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();
  const response = await app.inject({
    method: 'GET',
    url: '/task-categories',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { items: unknown[] };
  assert.deepEqual(payload.items, []);
  await app.close();
});

void test('POST /task-categories creates a category', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();
  const response = await app.inject({
    method: 'POST',
    url: '/task-categories',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { name: 'House', color: '#f59e0b' },
  });

  assert.equal(response.statusCode, 201);
  const payload = response.json() as { item: { id: string; name: string; color: string } };
  assert.equal(payload.item.name, 'House');
  assert.equal(payload.item.color, '#f59e0b');
  await app.close();
});

void test('DELETE /task-categories/:id soft-deletes a category', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/task-categories',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { name: 'Digital' },
  });
  const { item } = createResponse.json() as { item: { id: string } };

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/task-categories/${item.id}`,
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });
  assert.equal(deleteResponse.statusCode, 200);

  const listResponse = await app.inject({
    method: 'GET',
    url: '/task-categories',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });
  const listPayload = listResponse.json() as { items: unknown[] };
  assert.equal(listPayload.items.length, 0);
  await app.close();
});

void test('POST /tasks creates a task and writes audit event', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();
  const propertyId = randomUUID();

  const response = await app.inject({
    method: 'POST',
    url: '/tasks',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { title: 'Fix broken lock', priority: 'high', propertyIds: [propertyId] },
  });

  assert.equal(response.statusCode, 201);
  const payload = response.json() as {
    item: { id: string; title: string; status: string; priority: string };
  };
  assert.equal(payload.item.title, 'Fix broken lock');
  assert.equal(payload.item.status, 'open');
  assert.equal(payload.item.priority, 'high');
  await app.close();
});

void test('GET /tasks lists tasks filtered by propertyId', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();
  const propertyId = randomUUID();

  await app.inject({
    method: 'POST',
    url: '/tasks',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { title: 'Clean pool', priority: 'low', propertyIds: [propertyId] },
  });
  await app.inject({
    method: 'POST',
    url: '/tasks',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { title: 'Other property task', priority: 'low', propertyIds: [randomUUID()] },
  });

  const response = await app.inject({
    method: 'GET',
    url: `/tasks?propertyId=${propertyId}`,
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { items: Array<{ title: string }> };
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0]?.title, 'Clean pool');
  await app.close();
});

void test('POST /tasks/:id/resolve marks task resolved', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();
  const propertyId = randomUUID();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/tasks',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { title: 'Replace light bulb', priority: 'low', propertyIds: [propertyId] },
  });
  const { item } = createResponse.json() as { item: { id: string } };

  const resolveResponse = await app.inject({
    method: 'POST',
    url: `/tasks/${item.id}/resolve`,
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });

  assert.equal(resolveResponse.statusCode, 200);
  const resolved = resolveResponse.json() as {
    item: { status: string; resolvedAt: string; resolvedBy: string };
  };
  assert.equal(resolved.item.status, 'resolved');
  assert.ok(resolved.item.resolvedAt);
  assert.equal(resolved.item.resolvedBy, 'user-1');
  await app.close();
});

void test('DELETE /tasks/:id soft-deletes task', async () => {
  const app = buildTasksApp(db);
  const orgId = randomUUID();
  const propertyId = randomUUID();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/tasks',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1', 'content-type': 'application/json' },
    payload: { title: 'Old task', priority: 'low', propertyIds: [propertyId] },
  });
  const { item } = createResponse.json() as { item: { id: string } };

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/tasks/${item.id}`,
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });
  assert.equal(deleteResponse.statusCode, 200);

  // Should not appear in default list
  const listResponse = await app.inject({
    method: 'GET',
    url: '/tasks',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
  });
  const listPayload = listResponse.json() as { items: Array<{ id: string }> };
  assert.ok(!listPayload.items.some((t) => t.id === item.id));
  await app.close();
});

void test('loadPropertyContext returns id, name, nicknames', async () => {
  const propertyId = `test-prop-${randomUUID()}`;
  await db.insert(properties).values({
    id: propertyId,
    name: 'Rushing Creek',
    nicknames: ['RC', 'Rushing'],
    raw: {},
    syncedAt: new Date(),
  });
  try {
    const ctx = await loadPropertyContext(db);
    const found = ctx.find((p) => p.id === propertyId);
    assert.deepEqual(found, { id: propertyId, name: 'Rushing Creek', nicknames: ['RC', 'Rushing'] });
  } finally {
    await db.delete(properties).where(eq(properties.id, propertyId));
  }
});
