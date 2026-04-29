import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import type { Assessment, AssessmentTrigger } from '@/lib/guest-assessment';

import { handleAssess } from './handler';

type AssessFn = (
  id: string,
  opts: { organizationId: string; trigger: AssessmentTrigger; userId?: string },
) => Promise<Assessment | null>;

type FindFn = (id: string) => Promise<{ id: string } | null>;

const sampleAssessment: Assessment = {
  score: 7,
  summary: 's',
  riskLevel: 'low',
  trustLevel: 'high',
  recommendation: 'r',
  signals: [],
  rulesAcceptance: { requested: false, confirmed: false, confirmedAt: null, confirmationQuote: null },
};

void test('returns 404 when reservation does not exist', async () => {
  const findReservation = mock.fn<FindFn>(() => Promise.resolve(null));
  const assess = mock.fn<AssessFn>(() => Promise.resolve(sampleAssessment));
  const req = new Request('http://test', { method: 'POST', body: JSON.stringify({}) });
  const res = await handleAssess(req, 'res-missing', { orgId: 'o-1', userId: 'u-1' }, { findReservation, assess });
  assert.equal(res.status, 404);
  assert.equal(assess.mock.callCount(), 0);
});

void test('returns 503 when assessment returns null', async () => {
  const findReservation = mock.fn<FindFn>(() => Promise.resolve({ id: 'res-1' }));
  const assess = mock.fn<AssessFn>(() => Promise.resolve(null));
  const req = new Request('http://test', { method: 'POST', body: JSON.stringify({}) });
  const res = await handleAssess(req, 'res-1', { orgId: 'o-1', userId: 'u-1' }, { findReservation, assess });
  assert.equal(res.status, 503);
});

void test('passes trigger=manual_rescore by default and orgId/userId through', async () => {
  const findReservation = mock.fn<FindFn>(() => Promise.resolve({ id: 'res-1' }));
  const assess = mock.fn<AssessFn>(() => Promise.resolve(sampleAssessment));
  const req = new Request('http://test', { method: 'POST', body: JSON.stringify({}) });
  const res = await handleAssess(req, 'res-1', { orgId: 'o-1', userId: 'u-1' }, { findReservation, assess });
  assert.equal(assess.mock.callCount(), 1);
  const call = assess.mock.calls[0];
  assert.ok(call);
  assert.equal(call.arguments[0], 'res-1');
  assert.equal(call.arguments[1].trigger, 'manual_rescore');
  assert.equal(call.arguments[1].organizationId, 'o-1');
  assert.equal(call.arguments[1].userId, 'u-1');
  const body = (await res.json()) as { score: number; riskLevel: string };
  assert.equal(body.score, 7);
  assert.equal(body.riskLevel, 'low');
});
