import assert from 'node:assert/strict';
import test from 'node:test';

import {
  approveDraft,
  completeInternalValidation,
  createDraft,
  createIncident,
  createStore,
  editDraft,
  getOperationalAwareness,
  getRoiMetrics,
  getRiskRecommendation,
  getRolloutState,
  getStrategyRecommendation,
  listEvents,
  listTrainingSignals,
  onboardHost,
  recordGuestReview,
  recordRefund,
  sendDraft,
  transitionIncident
} from './command-center-store';
import { POST as createDraftRoute } from '@/app/api/command-center/drafts/route';
import { POST as postOnboarding } from '@/app/api/command-center/onboarding/route';
import { GET as getAuditTimeline } from '@/app/api/command-center/audit/route';
import { PATCH as updateDraftRoute } from '@/app/api/command-center/queue/[id]/route';
import { GET as getRoi, POST as postRoi } from '@/app/api/command-center/roi/route';
import { GET as getRollout, PATCH as patchRollout } from '@/app/api/command-center/rollout/route';
import { GET as getTrainingSignals } from '@/app/api/command-center/training-signals/route';

void test('shows a control-tower queue with actionable items', () => {
  const store = createStore();
  const queue = store.listQueue();

  assert.equal(queue.length > 0, true);
  assert.equal(queue[0]?.status, 'pending');
});

void test('creates AI draft with visible sources', () => {
  const store = createStore({
    policiesByIntent: {
      'check-in-reminder': 'Check-in starts at 4:00 PM.'
    }
  });

  const created = createDraft(store, {
    reservationId: 'res-001',
    intent: 'check-in-reminder',
    context: { guestName: 'Jordan', checkInTime: '4:00 PM' }
  });

  assert.equal(created.sources.length > 0, true);
  assert.equal(created.body.includes('Jordan'), true);
});

void test('keeps approval/edit/send as default host-controlled flow', () => {
  const store = createStore({
    policiesByIntent: {
      'first-morning-check': 'Send first morning check by 9:00 AM.'
    }
  });
  const draft = createDraft(store, {
    reservationId: 'res-002',
    intent: 'first-morning-check',
    context: { guestName: 'Taylor' }
  });

  const edited = editDraft(store, draft.id, 'Welcome Taylor. Let us know if you need anything.');
  assert.equal(edited.status, 'edited');

  const approved = approveDraft(store, draft.id, 'host-001');
  assert.equal(approved.status, 'approved');

  const sent = sendDraft(store, draft.id, 'host-001');
  assert.equal(sent.status, 'sent');
});

void test('uses structured policy fields as authoritative source for drafts', () => {
  const store = createStore({
    policiesByIntent: {
      'check-in-reminder': 'Check-in starts at 4:00 PM. Early check-in requires approval.'
    }
  });

  assert.throws(
    () =>
      createDraft(store, {
        reservationId: 'res-003',
        intent: 'unknown-intent',
        context: { guestName: 'Alex' }
      }),
    /Missing policy context/
  );

  const draft = createDraft(store, {
    reservationId: 'res-004',
    intent: 'check-in-reminder',
    context: { guestName: 'Alex' }
  });

  const policySource = draft.sources.find((source) => source.type === 'policy');
  assert.equal(Boolean(policySource), true);
  assert.equal(policySource?.snippet.includes('Check-in starts at 4:00 PM'), true);
});

void test('updates operational awareness from emitted events instead of manual checklists', () => {
  const store = createStore({
    policiesByIntent: {
      'check-in-reminder': 'Check-in starts at 4:00 PM.'
    }
  });

  const draft = createDraft(store, {
    reservationId: 'res-005',
    intent: 'check-in-reminder',
    context: { guestName: 'Riley' }
  });
  approveDraft(store, draft.id, 'host-ops');

  const events = listEvents(store);
  const awareness = getOperationalAwareness(store);

  assert.equal(events.length >= 2, true);
  assert.equal(awareness.approvedCount >= 1, true);
  assert.equal(awareness.lastEventType, 'draft.approved');
});

void test('combines global trust with local risk tolerance for booking recommendation', () => {
  const recommendation = getRiskRecommendation({
    globalTrustScore: 82,
    localRiskTolerance: 35,
    localIncidentSignals: 2
  });

  assert.equal(recommendation.decision, 'review');
  assert.equal(recommendation.reasons.length > 0, true);
});

void test('enforces recovery state machine transitions for incident closure', () => {
  const store = createStore();
  const incident = createIncident(store, 'Missing pool heat');

  const inNegotiation = transitionIncident(store, incident.id, 'negotiation');
  assert.equal(inNegotiation.state, 'negotiation');

  const accepted = transitionIncident(store, incident.id, 'resolution-accepted');
  assert.equal(accepted.state, 'resolution-accepted');

  const closed = transitionIncident(store, incident.id, 'recovery-closed');
  assert.equal(closed.state, 'recovery-closed');

  assert.throws(() => transitionIncident(store, incident.id, 'active'), /Invalid transition/);
});

void test('keeps decisioning local-first while still using portfolio insights', () => {
  const recommendation = getStrategyRecommendation({
    localSeverity: 90,
    portfolioTrend: 'low-risk',
    portfolioConfidence: 95
  });

  assert.equal(recommendation.primaryDriver, 'local');
  assert.equal(recommendation.action, 'escalate-now');
});

void test('starts internal rollout with exactly 3 STR and 1 MTR properties', () => {
  const store = createStore();
  const rollout = getRolloutState(store);

  const strCount = rollout.properties.filter((property) => property.type === 'STR').length;
  const mtrCount = rollout.properties.filter((property) => property.type === 'MTR').length;

  assert.equal(strCount, 3);
  assert.equal(mtrCount, 1);
  assert.equal(rollout.internalOnly, true);
});

void test('requires internal validation before host-by-host onboarding', () => {
  const store = createStore();

  assert.throws(() => onboardHost(store, 'host-001'), /Internal validation is required/);

  completeInternalValidation(store);
  const host = onboardHost(store, 'host-001');

  assert.equal(host.status, 'onboarded');
});

void test('captures host edits as training signals with before/after text', () => {
  const store = createStore({
    policiesByIntent: {
      'check-in-reminder': 'Check-in starts at 4:00 PM.'
    }
  });

  const draft = createDraft(store, {
    reservationId: 'res-006',
    intent: 'check-in-reminder',
    context: { guestName: 'Jamie' }
  });

  editDraft(store, draft.id, 'Custom host wording for Jamie.');
  const signals = listTrainingSignals(store);

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.before.includes('Jamie'), true);
  assert.equal(signals[0]?.after, 'Custom host wording for Jamie.');
});

void test('tracks internal ROI metrics for response speed, incidents, refunds, and reviews', () => {
  const store = createStore({
    policiesByIntent: {
      'check-in-reminder': 'Check-in starts at 4:00 PM.'
    }
  });

  const draft = createDraft(store, {
    reservationId: 'res-007',
    intent: 'check-in-reminder',
    context: { guestName: 'Morgan' }
  });
  approveDraft(store, draft.id, 'host-ops');
  sendDraft(store, draft.id, 'host-ops');

  createIncident(store, 'Late cleaner arrival');
  recordRefund(store, 75);
  recordGuestReview(store, 5);

  const roi = getRoiMetrics(store);
  assert.equal(roi.incidentCount, 1);
  assert.equal(roi.totalRefundAmount, 75);
  assert.equal(roi.reviewAverage, 5);
  assert.equal(roi.messagesHandled > 0, true);
});

void test('returns internal rollout with 3 STR and 1 MTR via API', async () => {
  const response = await getRollout();
  const body = (await response.json()) as {
    rollout: { internalOnly: boolean; properties: Array<{ type: 'STR' | 'MTR' }> };
  };

  const strCount = body.rollout.properties.filter((property) => property.type === 'STR').length;
  const mtrCount = body.rollout.properties.filter((property) => property.type === 'MTR').length;

  assert.equal(body.rollout.internalOnly, true);
  assert.equal(strCount, 3);
  assert.equal(mtrCount, 1);
});

void test('blocks onboarding before validation and allows it after validation via API', async () => {
  const blocked = await postOnboarding(
    new Request('http://localhost/api/command-center/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hostId: 'host-pre-validation' })
    })
  );
  assert.equal(blocked.status, 400);

  await patchRollout(
    new Request('http://localhost/api/command-center/rollout', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'complete-internal-validation' })
    })
  );

  const onboarded = await postOnboarding(
    new Request('http://localhost/api/command-center/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hostId: 'host-validated' })
    })
  );
  const onboardedBody = (await onboarded.json()) as { host: { status: string } };
  assert.equal(onboarded.status, 201);
  assert.equal(onboardedBody.host.status, 'onboarded');
});

void test('exposes training signals captured from edited drafts via API', async () => {
  const created = await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-e02-training',
        intent: 'check-in-reminder',
        context: { guestName: 'Casey' }
      })
    })
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'edit', actorId: 'host-user', body: 'Custom host edit for Casey.' })
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) }
  );

  const signalsResponse = await getTrainingSignals();
  const signalsBody = (await signalsResponse.json()) as { signals: Array<{ after: string }> };
  assert.equal(signalsBody.signals.some((signal) => signal.after === 'Custom host edit for Casey.'), true);
});

void test('tracks ROI updates from refund and review events via API', async () => {
  const beforeResponse = await getRoi();
  const before = (await beforeResponse.json()) as { metrics: { totalRefundAmount: number; reviewAverage: number } };

  await postRoi(
    new Request('http://localhost/api/command-center/roi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'refund', amount: 42 })
    })
  );
  await postRoi(
    new Request('http://localhost/api/command-center/roi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'review', rating: 5 })
    })
  );

  const afterResponse = await getRoi();
  const after = (await afterResponse.json()) as { metrics: { totalRefundAmount: number; reviewAverage: number } };

  assert.equal(after.metrics.totalRefundAmount >= before.metrics.totalRefundAmount + 42, true);
  assert.equal(after.metrics.reviewAverage >= before.metrics.reviewAverage, true);
});

void test('reports onboarding progression status after hosts are onboarded', () => {
  const store = createStore();
  completeInternalValidation(store);

  onboardHost(store, 'host-001');
  onboardHost(store, 'host-002');

  const rollout = getRolloutState(store);

  assert.equal(rollout.onboardedHosts.length, 2);
  assert.equal(rollout.targetHostCount, 10);
  assert.equal(rollout.progressPercent, 20);
  assert.equal(rollout.phase, 'gradual-onboarding');
});

void test('marks rollout ready-to-scale when onboarding target is reached', () => {
  const store = createStore();
  completeInternalValidation(store);

  for (let index = 1; index <= 10; index += 1) {
    onboardHost(store, `host-${index}`);
  }

  const rollout = getRolloutState(store);

  assert.equal(rollout.progressPercent, 100);
  assert.equal(rollout.phase, 'ready-to-scale');
});

void test('returns dedicated audit timeline entries for draft lifecycle', async () => {
  const created = await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-audit-timeline',
        intent: 'check-in-reminder',
        context: { guestName: 'Audit Guest' }
      })
    })
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'edit', actorId: 'host-user', body: 'Edited body for timeline.' })
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) }
  );
  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', actorId: 'audit-approver' })
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) }
  );

  const timelineResponse = await getAuditTimeline(
    new Request(`http://localhost/api/command-center/audit?draftId=${createdBody.item.id}`)
  );
  const timelineBody = (await timelineResponse.json()) as {
    items: Array<{ draftId: string; action: 'created' | 'edited' | 'approved' | 'sent'; actorId: string }>;
  };

  assert.equal(timelineBody.items.length >= 3, true);
  assert.equal(timelineBody.items.some((entry) => entry.action === 'created'), true);
  assert.equal(timelineBody.items.some((entry) => entry.action === 'edited'), true);
  assert.equal(timelineBody.items.some((entry) => entry.action === 'approved' && entry.actorId === 'audit-approver'), true);
});

void test('filters audit timeline by action and actor', async () => {
  const created = await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-audit-filter',
        intent: 'check-in-reminder',
        context: { guestName: 'Filter Guest' }
      })
    })
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', actorId: 'filter-approver' })
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) }
  );

  const response = await getAuditTimeline(
    new Request(
      `http://localhost/api/command-center/audit?draftId=${createdBody.item.id}&action=approved&actorId=filter-approver`
    )
  );
  const body = (await response.json()) as {
    items: Array<{ draftId: string; action: 'created' | 'edited' | 'approved' | 'sent'; actorId: string }>;
  };

  assert.equal(body.items.length, 1);
  assert.equal(body.items[0]?.draftId, createdBody.item.id);
  assert.equal(body.items[0]?.action, 'approved');
  assert.equal(body.items[0]?.actorId, 'filter-approver');
});

void test('supports audit timeline date-range filtering via since/until query', async () => {
  const futureOnlyResponse = await getAuditTimeline(
    new Request('http://localhost/api/command-center/audit?since=2100-01-01T00:00:00.000Z')
  );
  const futureOnlyBody = (await futureOnlyResponse.json()) as { items: unknown[] };
  assert.equal(futureOnlyBody.items.length, 0);

  const pastOnlyResponse = await getAuditTimeline(
    new Request('http://localhost/api/command-center/audit?until=2000-01-01T00:00:00.000Z')
  );
  const pastOnlyBody = (await pastOnlyResponse.json()) as { items: unknown[] };
  assert.equal(pastOnlyBody.items.length, 0);
});
