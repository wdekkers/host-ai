import assert from 'node:assert/strict';
import test from 'node:test';
import { sendReminder } from './send-reminder';

const baseReminder = {
  id: 'rem-1',
  taskId: 'task-1',
  organizationId: 'org-1',
  channels: ['sms', 'email'] as ('sms' | 'email')[],
  scheduledFor: new Date('2026-03-20T13:00:00Z'),
  taskTitle: 'Start pool heating',
  propertyName: 'Palmera',
};

void test('sends sms and email when both channels configured', async () => {
  let smsSent = false;
  let emailSent = false;

  await sendReminder(baseReminder, {
    resolveContact: async () => ({ email: 'owner@example.com', phone: '+15551234567' }),
    sendSms: async () => { smsSent = true; },
    sendEmail: async () => { emailSent = true; },
  });

  assert.ok(smsSent);
  assert.ok(emailSent);
});

void test('skips sms gracefully when owner has no phone number', async () => {
  let smsSent = false;
  let emailSent = false;

  await sendReminder(baseReminder, {
    resolveContact: async () => ({ email: 'owner@example.com', phone: null }),
    sendSms: async () => { smsSent = true; },
    sendEmail: async () => { emailSent = true; },
  });

  assert.equal(smsSent, false);
  assert.ok(emailSent);
});

void test('throws if a configured channel send fails', async () => {
  await assert.rejects(
    () =>
      sendReminder({ ...baseReminder, channels: ['email'] }, {
        resolveContact: async () => ({ email: 'owner@example.com', phone: null }),
        sendSms: async () => {},
        sendEmail: async () => { throw new Error('Resend unavailable'); },
      }),
    /Resend unavailable/,
  );
});
