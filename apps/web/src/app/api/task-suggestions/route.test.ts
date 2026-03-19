import assert from 'node:assert/strict';
import test from 'node:test';
import { handleListTaskSuggestions } from './handler.js';

const authCtx = { orgId: 'org-1', userId: 'user-1', role: 'owner' as const };

void test('returns pending suggestions for org, newest first', async () => {
  const response = await handleListTaskSuggestions(
    new Request('http://localhost/api/task-suggestions'),
    authCtx,
    {
      querySuggestions: async ({ orgId, status }) => {
        assert.equal(orgId, 'org-1');
        assert.equal(status, 'pending');
        return [
          {
            id: 'sug-1',
            organizationId: 'org-1',
            propertyId: 'prop-1',
            propertyName: 'Palmera',
            reservationId: 'res-1',
            messageId: null,
            title: 'Start pool heating',
            description: null,
            suggestedDueDate: null,
            source: 'reservation',
            status: 'pending',
            createdAt: new Date('2026-03-19T12:00:00Z'),
          },
        ];
      },
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as { suggestions: Array<{ id: string }> };
  assert.equal(body.suggestions[0]?.id, 'sug-1');
});
