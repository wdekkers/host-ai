import assert from 'node:assert/strict';
import test from 'node:test';

import { TwilioSmsSender } from './client.js';

void test('TwilioSmsSender.send calls twilio with correct params', async () => {
  let capturedArgs: { to: string; from: string; body: string } | undefined;

  const mockTwilio = {
    messages: {
      create: async (args: { to: string; from: string; body: string }) => {
        capturedArgs = args;
        return { sid: 'SM123' };
      },
    },
  };

  const sender = new TwilioSmsSender({
    client: mockTwilio as never,
    fromNumber: '+15551234567',
  });

  await sender.send('+15559876543', 'Hello guest');

  assert.deepEqual(capturedArgs, {
    to: '+15559876543',
    from: '+15551234567',
    body: 'Hello guest',
  });
});

void test('TwilioSmsSender.send throws on failure', async () => {
  const mockTwilio = {
    messages: {
      create: async () => { throw new Error('Network error'); },
    },
  };

  const sender = new TwilioSmsSender({
    client: mockTwilio as never,
    fromNumber: '+15551234567',
  });

  await assert.rejects(() => sender.send('+15559876543', 'Hello'), /Network error/);
});
