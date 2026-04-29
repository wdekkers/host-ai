import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { handleAssess } from './handler';

test('returns 404 when reservation does not exist', async () => {
  const findReservation = mock.fn(() => Promise.resolve(null));
  const assess = mock.fn();
  const req = new Request('http://test', { method: 'POST', body: JSON.stringify({}) });
  const res = await handleAssess(req, 'res-missing', { orgId: 'o-1', userId: 'u-1' }, { findReservation, assess });
  assert.equal(res.status, 404);
  assert.equal(assess.mock.callCount(), 0);
});

test('returns 503 when assessment returns null', async () => {
  const findReservation = mock.fn(() => Promise.resolve({ id: 'res-1' }));
  const assess = mock.fn(() => Promise.resolve(null));
  const req = new Request('http://test', { method: 'POST', body: JSON.stringify({}) });
  const res = await handleAssess(req, 'res-1', { orgId: 'o-1', userId: 'u-1' }, { findReservation, assess });
  assert.equal(res.status, 503);
});

test('passes trigger=manual_rescore by default and orgId/userId through', async () => {
  const findReservation = mock.fn(() => Promise.resolve({ id: 'res-1' }));
  const assess = mock.fn(() => Promise.resolve({
    score: 7,
    summary: 's',
    riskLevel: 'low' as const,
    trustLevel: 'high' as const,
    recommendation: 'r',
    signals: [],
    rulesAcceptance: { requested: false, confirmed: false, confirmedAt: null, confirmationQuote: null },
  }));
  const req = new Request('http://test', { method: 'POST', body: JSON.stringify({}) });
  const res = await handleAssess(req, 'res-1', { orgId: 'o-1', userId: 'u-1' }, { findReservation, assess });
  assert.equal(assess.mock.callCount(), 1);
  const callArgs = assess.mock.calls[0]!.arguments;
  assert.equal(callArgs[0], 'res-1');
  assert.equal(callArgs[1].trigger, 'manual_rescore');
  assert.equal(callArgs[1].organizationId, 'o-1');
  assert.equal(callArgs[1].userId, 'u-1');
  const body = await res.json() as { score: number; riskLevel: string };
  assert.equal(body.score, 7);
  assert.equal(body.riskLevel, 'low');
});
