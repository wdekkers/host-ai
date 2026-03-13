import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createDb } from '@walt/db';
import { buildTasksApp } from './index.js';

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
