import assert from 'node:assert/strict';
import test from 'node:test';
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
