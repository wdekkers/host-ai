import assert from 'node:assert/strict';
import test from 'node:test';
import { sendViaHospitable } from './send-message';

void test('sends message successfully', async () => {
  const result = await sendViaHospitable(
    { conversationId: 'conv-1', body: 'Hello guest!' },
    {
      fetch: async (url, init) => {
        assert.ok(String(url).includes('/v2/conversations/conv-1/messages'));
        assert.equal(init?.method, 'POST');
        const reqBody = JSON.parse(init?.body as string);
        assert.equal(reqBody.body, 'Hello guest!');
        return new Response(JSON.stringify({ id: 'msg-123' }), { status: 200 });
      },
      apiKey: 'test-key',
      baseUrl: 'https://api.hospitable.com',
    },
  );

  assert.equal(result.success, true);
  assert.equal(result.platformMessageId, 'msg-123');
});

void test('returns error on API failure', async () => {
  const result = await sendViaHospitable(
    { conversationId: 'conv-1', body: 'Hello!' },
    {
      fetch: async () => new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 }),
      apiKey: 'test-key',
      baseUrl: 'https://api.hospitable.com',
    },
  );

  assert.equal(result.success, false);
  assert.ok(result.error?.includes('429'));
});

void test('returns error when config missing', async () => {
  const result = await sendViaHospitable(
    { conversationId: 'conv-1', body: 'Hello!' },
    { apiKey: '', baseUrl: '' },
  );

  assert.equal(result.success, false);
  assert.ok(result.error?.includes('not configured'));
});
