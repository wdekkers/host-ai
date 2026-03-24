import assert from 'node:assert/strict';
import test from 'node:test';
import { handleDismissSuggestion } from './handler';

const authCtx = { orgId: 'org-1', userId: 'user-1', role: 'owner' as const };

void test('dismiss: marks suggestion dismissed for correct org', async () => {
  let dismissed: { id: string; orgId: string } | undefined;

  const response = await handleDismissSuggestion(
    new Request('http://localhost/api/task-suggestions/sug-1/dismiss', { method: 'POST' }),
    { params: Promise.resolve({ id: 'sug-1' }) },
    authCtx,
    {
      markDismissed: async (id, orgId) => {
        dismissed = { id, orgId };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(dismissed, { id: 'sug-1', orgId: 'org-1' });
  const body = (await response.json()) as { ok: boolean };
  assert.equal(body.ok, true);
});
