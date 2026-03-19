import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAcceptSuggestion } from './handler.js';

const authCtx = { orgId: 'org-1', userId: 'user-1', role: 'owner' as const };
const params = Promise.resolve({ id: 'sug-1' });

const fakeSuggestion = {
  id: 'sug-1',
  organizationId: 'org-1',
  propertyId: 'prop-1',
  propertyName: 'Palmera',
  reservationId: 'res-1',
  title: 'Start pool heating',
  source: 'reservation',
};

void test('accept: creates task and marks suggestion accepted', async () => {
  let taskCreated = false;
  let suggestionUpdated = false;

  const response = await handleAcceptSuggestion(
    new Request('http://localhost/api/task-suggestions/sug-1/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer tok' },
      body: JSON.stringify({}),
    }),
    { params },
    authCtx,
    {
      getSuggestion: async () => fakeSuggestion,
      createTask: async () => { taskCreated = true; return { id: 'task-1' }; },
      markAccepted: async () => { suggestionUpdated = true; },
      createReminder: async () => { throw new Error('should not be called'); },
    },
  );

  assert.equal(response.status, 200);
  assert.ok(taskCreated);
  assert.ok(suggestionUpdated);
  const body = (await response.json()) as { task: { id: string } };
  assert.equal(body.task.id, 'task-1');
});

void test('accept: task creation failure → 502, suggestion not marked accepted', async () => {
  let suggestionUpdated = false;

  const response = await handleAcceptSuggestion(
    new Request('http://localhost/api/task-suggestions/sug-1/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
    { params },
    authCtx,
    {
      getSuggestion: async () => fakeSuggestion,
      createTask: async () => { throw new Error('gateway down'); },
      markAccepted: async () => { suggestionUpdated = true; },
      createReminder: async () => ({ id: 'rem-1' }),
    },
  );

  assert.equal(response.status, 502);
  assert.equal(suggestionUpdated, false);
});

void test('accept: task succeeds but reminder fails → 200 with reminderWarning, suggestion accepted', async () => {
  let suggestionUpdated = false;

  const response = await handleAcceptSuggestion(
    new Request('http://localhost/api/task-suggestions/sug-1/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reminderChannels: ['sms'], reminderTime: '2026-03-20T13:00:00Z' }),
    }),
    { params },
    authCtx,
    {
      getSuggestion: async () => fakeSuggestion,
      createTask: async () => ({ id: 'task-1' }),
      markAccepted: async () => { suggestionUpdated = true; },
      createReminder: async () => { throw new Error('db error'); },
    },
  );

  assert.equal(response.status, 200);
  assert.ok(suggestionUpdated);
  const body = (await response.json()) as { reminderWarning: string };
  assert.ok(body.reminderWarning);
});
