import test from 'node:test';
import assert from 'node:assert/strict';

import { NotificationRouter } from './router.js';
import type { NotificationRouterDeps } from './router.js';
import type { Notification } from './types.js';

function createMockRouter(overrides: Partial<NotificationRouterDeps>): NotificationRouter {
  return new NotificationRouter({
    sms: { send: async () => {} },
    email: { send: async () => {} },
    slack: { postMessage: async () => {} },
    getPreferences: async () => null,
    getRecipientContact: async () => ({ phone: '+15551234567', email: 'host@test.com' }),
    persistWebNotification: async () => {},
    ...overrides,
  });
}

const baseNotification: Notification = {
  organizationId: 'org-1',
  channels: ['sms'],
  category: 'booking',
  title: 'New Booking',
  body: 'You have a new booking.',
  urgency: 'normal',
};

test('sends SMS when channel includes sms and contact has phone', async () => {
  const smsCalls: { to: string; body: string }[] = [];
  const router = createMockRouter({
    sms: {
      send: async (to, body) => {
        smsCalls.push({ to, body });
      },
    },
  });

  await router.send({ ...baseNotification, channels: ['sms'] });

  assert.equal(smsCalls.length, 1);
  assert.equal(smsCalls[0]?.to, '+15551234567');
  assert.ok(smsCalls[0]?.body.includes('New Booking'));
  assert.ok(smsCalls[0]?.body.includes('[Hostpilot]'));
});

test('sends to multiple channels in parallel', async () => {
  const smsCalls: string[] = [];
  const emailCalls: string[] = [];
  const router = createMockRouter({
    sms: { send: async (to) => { smsCalls.push(to); } },
    email: { send: async (msg) => { emailCalls.push(msg.to); } },
  });

  await router.send({ ...baseNotification, channels: ['sms', 'email'] });

  assert.equal(smsCalls.length, 1);
  assert.equal(emailCalls.length, 1);
  assert.equal(smsCalls[0], '+15551234567');
  assert.equal(emailCalls[0], 'host@test.com');
});

test('always persists web notification when channel includes web', async () => {
  const persisted: Notification[] = [];
  const router = createMockRouter({
    persistWebNotification: async (n) => { persisted.push(n); },
  });

  await router.send({ ...baseNotification, channels: ['web'] });

  assert.equal(persisted.length, 1);
  assert.equal(persisted[0]?.title, 'New Booking');
});

test('skips SMS if no phone number available', async () => {
  const smsCalls: string[] = [];
  const router = createMockRouter({
    sms: { send: async (to) => { smsCalls.push(to); } },
    getRecipientContact: async () => ({ email: 'host@test.com' }),
  });

  await router.send({ ...baseNotification, channels: ['sms'] });

  assert.equal(smsCalls.length, 0);
});

test('sends email when channel includes email', async () => {
  const emailCalls: { to: string; subject: string; text: string }[] = [];
  const router = createMockRouter({
    email: {
      send: async (msg) => {
        emailCalls.push({ to: msg.to, subject: msg.subject, text: msg.text });
      },
    },
  });

  await router.send({ ...baseNotification, channels: ['email'] });

  assert.equal(emailCalls.length, 1);
  assert.equal(emailCalls[0]?.to, 'host@test.com');
  assert.ok(emailCalls[0]?.subject.includes('[Hostpilot]'));
  assert.ok(emailCalls[0]?.subject.includes('New Booking'));
  assert.equal(emailCalls[0]?.text, 'You have a new booking.');
});
