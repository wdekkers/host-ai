import assert from 'node:assert/strict';
import test from 'node:test';

import { handleFeedback } from './handler';

void test('handleFeedback target=rule inserts a new scoring rule and rescores', async () => {
  let createRuleArgs: { orgId: string; userId: string; ruleText: string } | undefined;
  let appendCalled = false;
  let rescoreArg: { reservationId: string; orgId: string; userId: string } | undefined;

  const response = await handleFeedback(
    new Request('http://localhost/api/inbox/res-1/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: 'Pet exception-seeking = red flag',
        target: 'rule',
      }),
    }),
    'res-1',
    { orgId: 'o-1', userId: 'u-1' },
    {
      createRule: async (args) => {
        createRuleArgs = args;
        return { id: 'rule-new' };
      },
      appendGuestNote: async () => {
        appendCalled = true;
        return { ok: true as const };
      },
      rescore: async (args) => {
        rescoreArg = args;
        return { score: 4, summary: 'rescored summary' };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(createRuleArgs, {
    orgId: 'o-1',
    userId: 'u-1',
    ruleText: 'Pet exception-seeking = red flag',
  });
  assert.equal(appendCalled, false);
  assert.deepEqual(rescoreArg, { reservationId: 'res-1', orgId: 'o-1', userId: 'u-1' });
  const body = (await response.json()) as { score: number; summary: string };
  assert.equal(body.score, 4);
  assert.equal(body.summary, 'rescored summary');
});

void test('handleFeedback target=guest appends to guest notes and rescores', async () => {
  let createCalled = false;
  let appendArgs:
    | { orgId: string; reservationId: string; note: string }
    | undefined;

  const response = await handleFeedback(
    new Request('http://localhost/api/inbox/res-1/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Tried to bring a dog.', target: 'guest' }),
    }),
    'res-1',
    { orgId: 'o-1', userId: 'u-1' },
    {
      createRule: async () => {
        createCalled = true;
        return { id: 'should-not-happen' };
      },
      appendGuestNote: async (args) => {
        appendArgs = args;
        return { ok: true as const };
      },
      rescore: async () => ({ score: 5, summary: 's' }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(createCalled, false);
  assert.deepEqual(appendArgs, {
    orgId: 'o-1',
    reservationId: 'res-1',
    note: 'Tried to bring a dog.',
  });
  const body = (await response.json()) as { score: number; summary: string };
  assert.equal(body.score, 5);
  assert.equal(body.summary, 's');
});

void test('handleFeedback rejects empty text', async () => {
  let createCalled = false;
  let appendCalled = false;
  let rescoreCalled = false;

  const response = await handleFeedback(
    new Request('http://localhost/api/inbox/res-1/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '   ', target: 'rule' }),
    }),
    'res-1',
    { orgId: 'o-1', userId: 'u-1' },
    {
      createRule: async () => {
        createCalled = true;
        return { id: 'nope' };
      },
      appendGuestNote: async () => {
        appendCalled = true;
        return { ok: true as const };
      },
      rescore: async () => {
        rescoreCalled = true;
        return { score: 0, summary: '' };
      },
    },
  );

  assert.equal(response.status, 400);
  assert.equal(createCalled, false);
  assert.equal(appendCalled, false);
  assert.equal(rescoreCalled, false);
});
