import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMessage } from './analyze-message';

void test('returns intent, escalation, and suggestedTask from LLM', async () => {
  const result = await analyzeMessage(
    {
      body: 'Can we check in at 2pm instead of 4pm?',
      guestFirstName: 'Alice',
      propertyName: 'Palmera',
      arrivalDate: '2026-03-25',
    },
    {
      callAi: async () => JSON.stringify({
        intent: 'early_check_in',
        escalationLevel: 'none',
        escalationReason: null,
        hasSuggestedTask: true,
        taskTitle: 'Early check-in request for Alice at Palmera',
        taskDescription: 'Guest wants to check in at 2pm instead of 4pm.',
      }),
    },
  );

  assert.equal(result.intent, 'early_check_in');
  assert.equal(result.escalationLevel, 'none');
  assert.equal(result.escalationReason, null);
  assert.ok(result.suggestedTask);
  assert.equal(result.suggestedTask!.title, 'Early check-in request for Alice at Palmera');
});

void test('keyword escalate + LLM none = caution', async () => {
  const result = await analyzeMessage(
    {
      body: 'The refund policy seems confusing, can you clarify check-in time?',
      guestFirstName: 'Bob',
      propertyName: 'Casa Sol',
      arrivalDate: '2026-04-01',
    },
    {
      callAi: async () => JSON.stringify({
        intent: 'general_question',
        escalationLevel: 'none',
        escalationReason: null,
        hasSuggestedTask: false,
      }),
    },
  );

  assert.equal(result.escalationLevel, 'caution');
});

void test('keyword caution + LLM none = none', async () => {
  const result = await analyzeMessage(
    {
      body: 'Can you report the wifi name? I want to review it before arrival.',
      guestFirstName: 'Carol',
      propertyName: 'Villa Nova',
      arrivalDate: '2026-04-05',
    },
    {
      callAi: async () => JSON.stringify({
        intent: 'general_question',
        escalationLevel: 'none',
        escalationReason: null,
        hasSuggestedTask: false,
      }),
    },
  );

  assert.equal(result.escalationLevel, 'none');
});

void test('LLM escalation overrides keyword none', async () => {
  const result = await analyzeMessage(
    {
      body: 'I am extremely unhappy with how this situation was handled.',
      guestFirstName: 'Dave',
      propertyName: 'Beachside',
      arrivalDate: '2026-04-10',
    },
    {
      callAi: async () => JSON.stringify({
        intent: 'complaint',
        escalationLevel: 'escalate',
        escalationReason: 'Guest expressing significant distress about service',
        hasSuggestedTask: false,
      }),
    },
  );

  assert.equal(result.escalationLevel, 'escalate');
  assert.equal(result.escalationReason, 'Guest expressing significant distress about service');
});

void test('returns defaults on JSON parse failure', async () => {
  const result = await analyzeMessage(
    {
      body: 'Hello',
      guestFirstName: 'Eve',
      propertyName: 'Sunset',
      arrivalDate: '2026-04-15',
    },
    {
      callAi: async () => 'not valid json',
    },
  );

  assert.equal(result.intent, 'unknown');
  assert.equal(result.escalationLevel, 'none');
  assert.equal(result.suggestedTask, null);
});

void test('parse failure with escalation keyword falls back to caution', async () => {
  const result = await analyzeMessage(
    {
      body: 'I want a refund for this terrible experience',
      guestFirstName: 'Frank',
      propertyName: 'Beach House',
      arrivalDate: '2026-04-20',
    },
    {
      callAi: async () => 'not valid json',
    },
  );

  assert.equal(result.escalationLevel, 'caution');
});

void test('returns needsReply true for a question', async () => {
  const result = await analyzeMessage(
    {
      body: 'What time is check-in?',
      guestFirstName: 'Grace',
      propertyName: 'Lake House',
      arrivalDate: '2026-04-01',
    },
    {
      callAi: async () => JSON.stringify({
        intent: 'general_question',
        escalationLevel: 'none',
        escalationReason: null,
        hasSuggestedTask: false,
        needsReply: true,
      }),
    },
  );

  assert.equal(result.needsReply, true);
});

void test('returns needsReply false for a conversation-ender', async () => {
  const result = await analyzeMessage(
    {
      body: 'Ok thanks!',
      guestFirstName: 'Hank',
      propertyName: 'Beach Villa',
      arrivalDate: '2026-04-05',
    },
    {
      callAi: async () => JSON.stringify({
        intent: 'compliment',
        escalationLevel: 'none',
        escalationReason: null,
        hasSuggestedTask: false,
        needsReply: false,
      }),
    },
  );

  assert.equal(result.needsReply, false);
});

void test('defaults needsReply to true when AI omits it', async () => {
  const result = await analyzeMessage(
    {
      body: 'Hello there',
      guestFirstName: 'Ivy',
      propertyName: 'Mountain Lodge',
      arrivalDate: '2026-04-10',
    },
    {
      callAi: async () => JSON.stringify({
        intent: 'general_question',
        escalationLevel: 'none',
        escalationReason: null,
        hasSuggestedTask: false,
      }),
    },
  );

  assert.equal(result.needsReply, true);
});

void test('defaults needsReply to true on JSON parse failure', async () => {
  const result = await analyzeMessage(
    {
      body: 'Hello',
      guestFirstName: 'Jay',
      propertyName: 'Sunset',
      arrivalDate: '2026-04-15',
    },
    {
      callAi: async () => 'not valid json',
    },
  );

  assert.equal(result.needsReply, true);
});
