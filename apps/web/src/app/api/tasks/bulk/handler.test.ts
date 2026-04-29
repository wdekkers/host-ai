import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { handleBulkCreate } from './handler';

void test('returns 400 on invalid input', async () => {
  const req = new Request('http://x', { method: 'POST', body: JSON.stringify({}) });
  const res = await handleBulkCreate(req);
  assert.equal(res.status, 400);
});

void test('proxies to gateway and forwards status', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ results: [] }), { status: 200 }),
  );
  const req = new Request('http://x', {
    method: 'POST',
    body: JSON.stringify({ drafts: [{ title: 'A', priority: 'medium', propertyIds: ['p1'] }], source: 'manual' }),
  });
  const res = await handleBulkCreate(req);
  assert.equal(res.status, 200);
  assert.ok(fetchMock.mock.calls.length > 0);
  mock.restoreAll();
});

void test('returns 502 on fetch failure', async () => {
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('network');
  });
  const req = new Request('http://x', {
    method: 'POST',
    body: JSON.stringify({ drafts: [{ title: 'A', priority: 'medium', propertyIds: ['p1'] }], source: 'manual' }),
  });
  const res = await handleBulkCreate(req);
  assert.equal(res.status, 502);
  mock.restoreAll();
});
