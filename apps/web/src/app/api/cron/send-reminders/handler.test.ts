import assert from 'node:assert/strict';
import test from 'node:test';
import { handleSendReminders } from './handler';

const makeRequest = () =>
  new Request('http://localhost/api/cron/send-reminders', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  });

void test('sends due reminders and marks sent_at', async () => {
  let sentId: string | undefined;

  const response = await handleSendReminders(makeRequest(), {
    cronSecret: 'test-secret',
    getDueReminders: async () => [
      {
        id: 'rem-1',
        taskId: 'task-1',
        organizationId: 'org-1',
        taskTitle: 'Start pool heating',
        propertyName: 'Palmera',
        channels: ['email'],
        scheduledFor: new Date(),
      },
    ],
    deliver: async () => {},
    markSent: async (id) => { sentId = id; },
  });

  assert.equal(response.status, 200);
  assert.equal(sentId, 'rem-1');
  const body = (await response.json()) as { sent: number };
  assert.equal(body.sent, 1);
});

void test('leaves sent_at null and logs when delivery fails', async () => {
  let sentId: string | undefined;

  const response = await handleSendReminders(makeRequest(), {
    cronSecret: 'test-secret',
    getDueReminders: async () => [
      {
        id: 'rem-2',
        taskId: 'task-2',
        organizationId: 'org-1',
        taskTitle: 'Send welcome message',
        propertyName: 'Casa Blanca',
        channels: ['sms'],
        scheduledFor: new Date(),
      },
    ],
    deliver: async () => { throw new Error('Twilio down'); },
    markSent: async (id) => { sentId = id; },
  });

  assert.equal(response.status, 200);
  assert.equal(sentId, undefined);
  const body = (await response.json()) as { failed: number };
  assert.equal(body.failed, 1);
});

void test('returns 401 with wrong secret', async () => {
  const response = await handleSendReminders(
    new Request('http://localhost/api/cron/send-reminders', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    }),
    { cronSecret: 'test-secret' },
  );
  assert.equal(response.status, 401);
});
