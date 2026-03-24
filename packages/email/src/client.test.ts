import assert from 'node:assert/strict';
import test from 'node:test';

import { ResendEmailSender } from './client.js';

void test('ResendEmailSender.send calls resend with correct params', async () => {
  let capturedArgs: Record<string, unknown> | undefined;

  const mockResend = {
    emails: {
      send: async (args: Record<string, unknown>) => {
        capturedArgs = args;
        return { id: 'email-123' };
      },
    },
  };

  const sender = new ResendEmailSender({
    client: mockResend as never,
    fromAddress: 'walt@notifications.walt.ai',
  });

  await sender.send({
    to: 'host@example.com',
    subject: 'Reminder',
    text: 'Your guest is arriving tomorrow',
  });

  assert.equal(capturedArgs?.to, 'host@example.com');
  assert.equal(capturedArgs?.subject, 'Reminder');
  assert.equal(capturedArgs?.from, 'walt@notifications.walt.ai');
});

void test('ResendEmailSender.send throws on failure', async () => {
  const mockResend = {
    emails: {
      send: async () => { throw new Error('API error'); },
    },
  };

  const sender = new ResendEmailSender({
    client: mockResend as never,
    fromAddress: 'walt@notifications.walt.ai',
  });

  await assert.rejects(() => sender.send({ to: 'x', subject: 'x', text: 'x' }), /API error/);
});
