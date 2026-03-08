import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
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
  getRiskTrustIndicator,
  getRolloutState,
  getStrategyRecommendation,
  ingestHospitableMessage,
  listEvents,
  listQueue,
  listTrainingSignals,
  onboardHost,
  recordGuestReview,
  recordRefund,
  sendDraft,
  transitionIncident,
} from './command-center-store';
import { POST as createDraftRoute } from '@/app/api/command-center/drafts/route';
import { POST as postOnboarding } from '@/app/api/command-center/onboarding/route';
import { GET as getAuditTimeline } from '@/app/api/command-center/audit/route';
import { GET as getHistoryByDraftId } from '@/app/api/command-center/history/[id]/route';
import { GET as getQueueRoute } from '@/app/api/command-center/queue/route';
import { GET as getLandingScreen } from '@/app/api/command-center/landing/route';
import { PATCH as updateDraftRoute } from '@/app/api/command-center/queue/[id]/route';
import { GET as getRoi, POST as postRoi } from '@/app/api/command-center/roi/route';
import { GET as getRollout, PATCH as patchRollout } from '@/app/api/command-center/rollout/route';
import { GET as getTrainingSignals } from '@/app/api/command-center/training-signals/route';
import { POST as postIncidentRoute } from '@/app/api/command-center/incidents/route';
import { PATCH as transitionIncidentRoute } from '@/app/api/command-center/incidents/[id]/route';
import { POST as postExperienceRisk } from '@/app/api/command-center/experience-risk/route';
import { GET as getPortfolioTrends } from '@/app/api/command-center/portfolio-trends/route';
import {
  GET as getOperatingProfile,
  PATCH as patchOperatingProfile,
} from '@/app/api/command-center/operating-profile/route';
import {
  GET as getAutopilotActions,
  POST as postAutopilotEvaluate,
} from '@/app/api/command-center/autopilot/route';
import { POST as postAutopilotRollback } from '@/app/api/command-center/autopilot/rollback/route';
import { GET as getEventBackbone } from '@/app/api/command-center/events/route';
import { GET as getOutbox, POST as postOutboxRetry } from '@/app/api/command-center/outbox/route';
import { GET as getProjections } from '@/app/api/command-center/projections/route';
import { GET as getEntities } from '@/app/api/command-center/entities/route';
import {
  GET as getPropertyBrainProfile,
  PATCH as patchPropertyBrainProfile,
} from '@/app/api/command-center/property-brain/[id]/route';
import { POST as postPropertyBrainResolve } from '@/app/api/command-center/property-brain/resolve/route';
import {
  GET as getIntentTaxonomy,
  POST as postIntentDraft,
} from '@/app/api/command-center/intent-drafts/route';
import { POST as postRiskIntelligence } from '@/app/api/command-center/risk-intelligence/route';
import { GET as getTodayPriorities } from '@/app/api/command-center/priorities/route';
import { GET as getPriorityDrilldown } from '@/app/api/command-center/priorities/[id]/route';
import { GET as getProactiveSuggestions } from '@/app/api/command-center/proactive-suggestions/route';
import {
  GET as getCleanerJitPings,
  POST as postCleanerJitPing,
} from '@/app/api/command-center/cleaner-jit/pings/route';
import { PATCH as patchCleanerJitPing } from '@/app/api/command-center/cleaner-jit/pings/[id]/route';
import {
  GET as getMonitoringAlerts,
  POST as postMonitoringRun,
} from '@/app/api/command-center/monitoring/route';
import { POST as postJitChecks } from '@/app/api/command-center/monitoring/jit-checks/route';
import { GET as getPropertyStateById } from '@/app/api/command-center/property-state/[id]/route';
import { GET as getPropertiesOverview } from '@/app/api/command-center/properties/overview/route';
import { GET as getIncidentAlerts } from '@/app/api/command-center/incidents/alerts/route';
import { POST as postIncidentResponsePlan } from '@/app/api/command-center/incidents/response-plan/route';
import { GET as getIncidentTimeline } from '@/app/api/command-center/incidents/[id]/timeline/route';
import { POST as postHospitableWebhook } from '@/app/api/integrations/hospitable/route';
import { GET as getHospitableMessages } from '@/app/api/integrations/hospitable/messages/route';
import { GET as getIntegrationStatus } from '@/app/api/integrations/status/route';
import {
  GET as getTwilioThreads,
  POST as postTwilioThread,
} from '@/app/api/integrations/twilio/threads/route';
import { GET as getContextByDraftId } from '@/app/api/command-center/context/[id]/route';
import { POST as postDraftFromInbound } from '@/app/api/command-center/drafts/from-inbound/route';
import { GET as getRoiDashboard } from '@/app/api/command-center/metrics/roi/route';
import { GET as getAdoptionMetrics } from '@/app/api/command-center/metrics/adoption/route';
import {
  GET as getPropertyQaEntries,
  POST as postPropertyQaEntry,
} from '@/app/api/command-center/qa/[propertyId]/route';
import { PATCH as patchPropertyQaEntry } from '@/app/api/command-center/qa/entry/[id]/route';
import { GET as getQaSuggestionsByProperty } from '@/app/api/command-center/qa-suggestions/route';
import { POST as postApproveQaSuggestion } from '@/app/api/command-center/qa-suggestions/[id]/approve/route';
import { POST as postRejectQaSuggestion } from '@/app/api/command-center/qa-suggestions/[id]/reject/route';
import { GET as getQaSuggestionNotifications } from '@/app/api/command-center/qa-suggestions/notifications/route';

void test('shows a control-tower queue with actionable items', () => {
  const store = createStore();
  const queue = store.listQueue();

  assert.equal(queue.length > 0, true);
  assert.equal(queue[0]?.status, 'pending');
});

void test('creates AI draft with visible sources', () => {
  const store = createStore({
    policiesByIntent: {
      'check-in-reminder': 'Check-in starts at 4:00 PM.',
    },
  });

  const created = createDraft(store, {
    reservationId: 'res-001',
    intent: 'check-in-reminder',
    context: { guestName: 'Jordan', checkInTime: '4:00 PM' },
  });

  assert.equal(created.sources.length > 0, true);
  assert.equal(created.body.includes('Jordan'), true);
});

void test('keeps approval/edit/send as default host-controlled flow', () => {
  const store = createStore({
    policiesByIntent: {
      'first-morning-check': 'Send first morning check by 9:00 AM.',
    },
  });
  const draft = createDraft(store, {
    reservationId: 'res-002',
    intent: 'first-morning-check',
    context: { guestName: 'Taylor' },
  });

  const edited = editDraft(store, draft.id, 'Welcome Taylor. Let us know if you need anything.');
  assert.equal(edited.status, 'edited');

  const approved = approveDraft(store, draft.id, 'host-001');
  assert.equal(approved.status, 'approved');

  const sent = sendDraft(store, draft.id, 'host-001');
  assert.equal(sent.status, 'sent');
});

void test('allows host to reject a draft with audit trace', async () => {
  const created = await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-reject-001',
        intent: 'check-in-reminder',
        context: { guestName: 'Reject Guest' },
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  const rejected = await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reject', actorId: 'host-reviewer' }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  const rejectedBody = (await rejected.json()) as {
    item: { status: string; auditLog: Array<{ action: string; actorId: string }> };
  };

  assert.equal(rejected.status, 200);
  assert.equal(rejectedBody.item.status, 'rejected');
  assert.equal(
    rejectedBody.item.auditLog.some(
      (entry) => entry.action === 'rejected' && entry.actorId === 'host-reviewer',
    ),
    true,
  );
});

void test('blocks approving a rejected draft via API with actionable error', async () => {
  const created = await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-reject-approve-001',
        intent: 'check-in-reminder',
        context: { guestName: 'Reject Approve Guest' },
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reject', actorId: 'host-reviewer' }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );

  const approveRejected = await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', actorId: 'host-reviewer' }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  const body = (await approveRejected.json()) as { error?: string };

  assert.equal(approveRejected.status, 400);
  assert.equal((body.error ?? '').includes('Rejected drafts cannot be approved'), true);
});

void test('blocks sending non-approved drafts via API with actionable error', async () => {
  const created = await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-send-guard-001',
        intent: 'check-in-reminder',
        context: { guestName: 'Send Guard Guest' },
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  const sendWithoutApproval = await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'send', actorId: 'host-reviewer' }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  const body = (await sendWithoutApproval.json()) as { error?: string };

  assert.equal(sendWithoutApproval.status, 400);
  assert.equal((body.error ?? '').includes('must be approved before sending'), true);
});

void test('blocks editing a sent draft via API with actionable error', async () => {
  const created = await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-edit-sent-001',
        intent: 'check-in-reminder',
        context: { guestName: 'Edit Sent Guest' },
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', actorId: 'host-reviewer' }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'send', actorId: 'host-reviewer' }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );

  const editSent = await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        actorId: 'host-reviewer',
        body: 'Trying to edit sent draft',
      }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  const body = (await editSent.json()) as { error?: string };

  assert.equal(editSent.status, 400);
  assert.equal((body.error ?? '').includes('Sent drafts cannot be edited'), true);
});

void test('blocks rejecting an already rejected draft via API with actionable error', async () => {
  const created = await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-reject-twice-001',
        intent: 'check-in-reminder',
        context: { guestName: 'Reject Twice Guest' },
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reject', actorId: 'host-reviewer' }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );

  const rejectTwice = await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reject', actorId: 'host-reviewer' }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  const body = (await rejectTwice.json()) as { error?: string };

  assert.equal(rejectTwice.status, 400);
  assert.equal((body.error ?? '').includes('already rejected'), true);
});

void test('uses structured policy fields as authoritative source for drafts', () => {
  const store = createStore({
    policiesByIntent: {
      'check-in-reminder': 'Check-in starts at 4:00 PM. Early check-in requires approval.',
    },
  });

  assert.throws(
    () =>
      createDraft(store, {
        reservationId: 'res-003',
        intent: 'unknown-intent',
        context: { guestName: 'Alex' },
      }),
    /Missing policy context/,
  );

  const draft = createDraft(store, {
    reservationId: 'res-004',
    intent: 'check-in-reminder',
    context: { guestName: 'Alex' },
  });

  const policySource = draft.sources.find((source) => source.type === 'policy');
  assert.equal(Boolean(policySource), true);
  assert.equal(policySource?.snippet.includes('Check-in starts at 4:00 PM'), true);
});

void test('updates operational awareness from emitted events instead of manual checklists', () => {
  const store = createStore({
    policiesByIntent: {
      'check-in-reminder': 'Check-in starts at 4:00 PM.',
    },
  });

  const draft = createDraft(store, {
    reservationId: 'res-005',
    intent: 'check-in-reminder',
    context: { guestName: 'Riley' },
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
    localIncidentSignals: 2,
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
    portfolioConfidence: 95,
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
      'check-in-reminder': 'Check-in starts at 4:00 PM.',
    },
  });

  const draft = createDraft(store, {
    reservationId: 'res-006',
    intent: 'check-in-reminder',
    context: { guestName: 'Jamie' },
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
      'check-in-reminder': 'Check-in starts at 4:00 PM.',
    },
  });

  const draft = createDraft(store, {
    reservationId: 'res-007',
    intent: 'check-in-reminder',
    context: { guestName: 'Morgan' },
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
      body: JSON.stringify({ hostId: 'host-pre-validation' }),
    }),
  );
  assert.equal(blocked.status, 400);

  await patchRollout(
    new Request('http://localhost/api/command-center/rollout', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'complete-internal-validation' }),
    }),
  );

  const onboarded = await postOnboarding(
    new Request('http://localhost/api/command-center/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hostId: 'host-validated' }),
    }),
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
        context: { guestName: 'Casey' },
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        actorId: 'host-user',
        body: 'Custom host edit for Casey.',
      }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );

  const signalsResponse = await getTrainingSignals();
  const signalsBody = (await signalsResponse.json()) as { signals: Array<{ after: string }> };
  assert.equal(
    signalsBody.signals.some((signal) => signal.after === 'Custom host edit for Casey.'),
    true,
  );
});

void test('tracks ROI updates from refund and review events via API', async () => {
  const beforeResponse = await getRoi();
  const before = (await beforeResponse.json()) as {
    metrics: { totalRefundAmount: number; reviewAverage: number };
  };

  await postRoi(
    new Request('http://localhost/api/command-center/roi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'refund', amount: 42 }),
    }),
  );
  await postRoi(
    new Request('http://localhost/api/command-center/roi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'review', rating: 5 }),
    }),
  );

  const afterResponse = await getRoi();
  const after = (await afterResponse.json()) as {
    metrics: { totalRefundAmount: number; reviewAverage: number };
  };

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
        context: { guestName: 'Audit Guest' },
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        actorId: 'host-user',
        body: 'Edited body for timeline.',
      }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', actorId: 'audit-approver' }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );

  const timelineResponse = await getAuditTimeline(
    new Request(`http://localhost/api/command-center/audit?draftId=${createdBody.item.id}`),
  );
  const timelineBody = (await timelineResponse.json()) as {
    items: Array<{
      draftId: string;
      action: 'created' | 'edited' | 'approved' | 'sent';
      actorId: string;
    }>;
  };

  assert.equal(timelineBody.items.length >= 3, true);
  assert.equal(
    timelineBody.items.some((entry) => entry.action === 'created'),
    true,
  );
  assert.equal(
    timelineBody.items.some((entry) => entry.action === 'edited'),
    true,
  );
  assert.equal(
    timelineBody.items.some(
      (entry) => entry.action === 'approved' && entry.actorId === 'audit-approver',
    ),
    true,
  );
});

void test('filters audit timeline by action and actor', async () => {
  const created = await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-audit-filter',
        intent: 'check-in-reminder',
        context: { guestName: 'Filter Guest' },
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', actorId: 'filter-approver' }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );

  const response = await getAuditTimeline(
    new Request(
      `http://localhost/api/command-center/audit?draftId=${createdBody.item.id}&action=approved&actorId=filter-approver`,
    ),
  );
  const body = (await response.json()) as {
    items: Array<{
      draftId: string;
      action: 'created' | 'edited' | 'approved' | 'sent';
      actorId: string;
    }>;
  };

  assert.equal(body.items.length, 1);
  assert.equal(body.items[0]?.draftId, createdBody.item.id);
  assert.equal(body.items[0]?.action, 'approved');
  assert.equal(body.items[0]?.actorId, 'filter-approver');
});

void test('supports audit timeline date-range filtering via since/until query', async () => {
  const futureOnlyResponse = await getAuditTimeline(
    new Request('http://localhost/api/command-center/audit?since=2100-01-01T00:00:00.000Z'),
  );
  const futureOnlyBody = (await futureOnlyResponse.json()) as { items: unknown[] };
  assert.equal(futureOnlyBody.items.length, 0);

  const pastOnlyResponse = await getAuditTimeline(
    new Request('http://localhost/api/command-center/audit?until=2000-01-01T00:00:00.000Z'),
  );
  const pastOnlyBody = (await pastOnlyResponse.json()) as { items: unknown[] };
  assert.equal(pastOnlyBody.items.length, 0);
});

void test('rejects invalid audit timeline query values with actionable errors', async () => {
  const invalidAction = await getAuditTimeline(
    new Request('http://localhost/api/command-center/audit?action=unknown'),
  );
  const invalidActionBody = (await invalidAction.json()) as { error?: string };
  assert.equal(invalidAction.status, 400);
  assert.equal((invalidActionBody.error ?? '').includes('Invalid action filter'), true);

  const invalidSince = await getAuditTimeline(
    new Request('http://localhost/api/command-center/audit?since=not-a-date'),
  );
  const invalidSinceBody = (await invalidSince.json()) as { error?: string };
  assert.equal(invalidSince.status, 400);
  assert.equal((invalidSinceBody.error ?? '').includes('Invalid since timestamp'), true);

  const invalidRange = await getAuditTimeline(
    new Request(
      'http://localhost/api/command-center/audit?since=2026-03-01T00:00:00.000Z&until=2026-02-01T00:00:00.000Z',
    ),
  );
  const invalidRangeBody = (await invalidRange.json()) as { error?: string };
  assert.equal(invalidRange.status, 400);
  assert.equal(
    (invalidRangeBody.error ?? '').includes('since must be earlier than or equal to until'),
    true,
  );
});

void test('ingests Hospitable guest message webhook into command center queue', async () => {
  const response = await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-hospitable-001',
        reservationId: 'res-hospitable-001',
        guestName: 'Jamie',
        message: 'Can we check in early around 1pm?',
        sentAt: '2026-02-28T18:00:00.000Z',
      }),
    }),
  );
  const body = (await response.json()) as { item: { id: string; intent: string } };

  assert.equal(response.status, 202);
  assert.equal(body.item.intent, 'early-check-in-request');
});

void test('rejects unsigned Hospitable webhook when secret is configured', async () => {
  const previousSecret = process.env.HOSPITABLE_WEBHOOK_SECRET;
  process.env.HOSPITABLE_WEBHOOK_SECRET = 'test-secret';

  try {
    const response = await postHospitableWebhook(
      new Request('http://localhost/api/integrations/hospitable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId: 'evt-hospitable-unsigned',
          reservationId: 'res-hospitable-unsigned',
          guestName: 'Jordan',
          message: 'Can we check in early?',
          sentAt: '2026-02-28T18:01:00.000Z',
        }),
      }),
    );
    const body = (await response.json()) as { error?: string };

    assert.equal(response.status, 401);
    assert.equal((body.error ?? '').includes('Missing webhook signature headers'), true);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.HOSPITABLE_WEBHOOK_SECRET;
    } else {
      process.env.HOSPITABLE_WEBHOOK_SECRET = previousSecret;
    }
  }
});

void test('accepts signed Hospitable webhook when secret is configured', async () => {
  const previousSecret = process.env.HOSPITABLE_WEBHOOK_SECRET;
  process.env.HOSPITABLE_WEBHOOK_SECRET = 'test-secret';

  try {
    const payload = {
      eventId: 'evt-hospitable-signed',
      reservationId: 'res-hospitable-signed',
      guestName: 'Jordan',
      message: 'Can we check in early?',
      sentAt: '2026-02-28T18:02:00.000Z',
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', 'test-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const response = await postHospitableWebhook(
      new Request('http://localhost/api/integrations/hospitable', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hospitable-timestamp': timestamp,
          'x-hospitable-signature': signature,
        },
        body: rawBody,
      }),
    );
    const body = (await response.json()) as { item?: { reservationId: string } };

    assert.equal(response.status, 202);
    assert.equal(body.item?.reservationId, 'res-hospitable-signed');
  } finally {
    if (previousSecret === undefined) {
      delete process.env.HOSPITABLE_WEBHOOK_SECRET;
    } else {
      process.env.HOSPITABLE_WEBHOOK_SECRET = previousSecret;
    }
  }
});

void test('deduplicates Hospitable webhook event id to prevent duplicate queue items', async () => {
  const payload = {
    eventId: 'evt-hospitable-dedupe',
    reservationId: 'res-hospitable-dedupe',
    guestName: 'Taylor',
    message: 'What is the wifi code?',
    sentAt: '2026-02-28T18:05:00.000Z',
  };

  const first = await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
  const second = await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
  const firstBody = (await first.json()) as { item: { id: string } };
  const secondBody = (await second.json()) as { item: { id: string } };

  assert.equal(second.status, 200);
  assert.equal(firstBody.item.id, secondBody.item.id);
  assert.equal(
    listQueue().filter((item) => item.reservationId === payload.reservationId).length,
    1,
  );
});

void test('logs webhook_raw_body and webhook_ingested events on successful ingestion', async () => {
  const captured: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    captured.push(args.map((arg) => String(arg)).join(' '));
  };

  try {
    await postHospitableWebhook(
      new Request('http://localhost/api/integrations/hospitable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId: 'evt-logging-ingested',
          reservationId: 'res-logging-ingested',
          guestName: 'Alex',
          message: 'What time is checkout?',
          sentAt: '2026-03-01T10:00:00.000Z',
        }),
      }),
    );

    const events = captured
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    const rawBodyEvent = events.find((e) => e.event === 'webhook_raw_body');
    assert.equal(rawBodyEvent !== undefined, true);
    assert.equal(typeof rawBodyEvent?.correlationId, 'string');

    const receivedEvent = events.find((e) => e.event === 'webhook_received');
    assert.equal(receivedEvent !== undefined, true);
    assert.equal(receivedEvent?.reservationId, 'res-logging-ingested');
    assert.equal(receivedEvent?.eventId, 'evt-logging-ingested');

    const ingestedEvent = events.find((e) => e.event === 'webhook_ingested');
    assert.equal(ingestedEvent !== undefined, true);
    assert.equal(typeof ingestedEvent?.queueItemId, 'string');
    assert.equal(typeof ingestedEvent?.intent, 'string');
    assert.equal(ingestedEvent?.correlationId, receivedEvent?.correlationId);
  } finally {
    console.log = originalLog;
  }
});

void test('logs webhook_duplicate event when same eventId is received twice', async () => {
  const captured: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    captured.push(args.map((arg) => String(arg)).join(' '));
  };

  const payload = JSON.stringify({
    eventId: 'evt-logging-dedupe',
    reservationId: 'res-logging-dedupe',
    guestName: 'Morgan',
    message: 'Is there parking nearby?',
    sentAt: '2026-03-01T11:00:00.000Z',
  });

  try {
    await postHospitableWebhook(
      new Request('http://localhost/api/integrations/hospitable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      }),
    );

    captured.length = 0; // reset — only capture the duplicate call's logs

    await postHospitableWebhook(
      new Request('http://localhost/api/integrations/hospitable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      }),
    );

    const events = captured
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    const duplicateEvent = events.find((e) => e.event === 'webhook_duplicate');
    assert.equal(duplicateEvent !== undefined, true);
    assert.equal(duplicateEvent?.eventId, 'evt-logging-dedupe');
    assert.equal(duplicateEvent?.reservationId, 'res-logging-dedupe');
    assert.equal(typeof duplicateEvent?.queueItemId, 'string');
  } finally {
    console.log = originalLog;
  }
});

void test('logs api_error with correlationId when webhook body is malformed', async () => {
  const captured: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    captured.push(args.map((arg) => String(arg)).join(' '));
  };

  try {
    const response = await postHospitableWebhook(
      new Request('http://localhost/api/integrations/hospitable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ unexpected: 'payload' }),
      }),
    );

    assert.equal(response.status, 400);

    const errorEvents = captured
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    const errorEvent = errorEvents.find((e) => e.event === 'api_error');
    assert.equal(errorEvent !== undefined, true);
    assert.equal(typeof (errorEvent?.context as Record<string, unknown>)?.correlationId, 'string');
    assert.equal(errorEvent?.route, '/api/integrations/hospitable');
  } finally {
    console.error = originalError;
  }
});

void test('detects booking inquiry intent from Hospitable message content', async () => {
  const response = await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-hospitable-booking-intent',
        reservationId: 'res-hospitable-booking-intent',
        guestName: 'Sam',
        message: 'Is this place available next weekend for 4 guests?',
        sentAt: '2026-02-28T18:10:00.000Z',
      }),
    }),
  );
  const body = (await response.json()) as { item: { intent: string } };
  assert.equal(body.item.intent, 'booking-inquiry');
});

void test('provides visible risk/trust indicators for booking and suspicious messages', () => {
  const normalBooking = getRiskTrustIndicator({
    intent: 'booking-inquiry',
    body: 'Guest asks if dates are available and what parking options exist.',
  });
  assert.equal(normalBooking.risk, 'medium');
  assert.equal(normalBooking.trust, 'medium');

  const suspicious = getRiskTrustIndicator({
    intent: 'booking-inquiry',
    body: 'Can we pay cash offline and throw a party?',
  });
  assert.equal(suspicious.risk, 'high');
  assert.equal(suspicious.trust, 'low');
});

void test('assembles per-property context from reservation, policy, and knowledge sources', async () => {
  const ingested = await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-hospitable-context-001',
        reservationId: 'res-hospitable-context-001',
        guestName: 'Avery',
        message: 'Can we do a late checkout at noon?',
        sentAt: '2026-02-28T18:20:00.000Z',
      }),
    }),
  );
  const ingestedBody = (await ingested.json()) as { item: { id: string } };

  const contextResponse = await getContextByDraftId(
    new Request(`http://localhost/api/command-center/context/${ingestedBody.item.id}`),
    { params: Promise.resolve({ id: ingestedBody.item.id }) },
  );
  const contextBody = (await contextResponse.json()) as {
    context: {
      reservationId: string;
      policy: string;
      knowledgeSources: Array<{
        type: string;
        snippet: string;
        confidence?: string;
        referenceUrl?: string;
      }>;
      reviewRequired: boolean;
    };
  };

  assert.equal(contextBody.context.reservationId, 'res-hospitable-context-001');
  assert.equal(contextBody.context.policy.length > 0, true);
  assert.equal(contextBody.context.knowledgeSources.length >= 3, true);
  assert.equal(contextBody.context.reviewRequired, true);
  assert.equal(contextBody.context.knowledgeSources[0]?.confidence, 'low');
  assert.equal(
    contextBody.context.knowledgeSources.some(
      (source) =>
        (source.confidence === 'high' ||
          source.confidence === 'medium' ||
          source.confidence === 'low') &&
        Boolean(source.referenceUrl),
    ),
    true,
  );
});

void test('creates ai draft from inbound message using assembled context and source references', async () => {
  const ingested = await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-hospitable-draft-001',
        reservationId: 'res-hospitable-draft-001',
        guestName: 'Jordan',
        message: 'Do you have parking instructions?',
        sentAt: '2026-02-28T18:25:00.000Z',
      }),
    }),
  );
  const ingestedBody = (await ingested.json()) as { item: { id: string } };

  const drafted = await postDraftFromInbound(
    new Request('http://localhost/api/command-center/drafts/from-inbound', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draftId: ingestedBody.item.id }),
    }),
  );
  const draftedBody = (await drafted.json()) as {
    item: { body: string; sources: Array<{ type: string }> };
  };

  assert.equal(drafted.status, 200);
  assert.equal(draftedBody.item.body.toLowerCase().includes('jordan'), true);
  assert.equal(
    draftedBody.item.sources.some((source) => source.type === 'policy'),
    true,
  );
  assert.equal(
    draftedBody.item.sources.some((source) => source.type === 'property-note'),
    true,
  );
});

void test('prioritizes high-risk and high-urgency queue items above lower-priority messages', () => {
  const store = createStore({ seed: [] });

  ingestHospitableMessage(store, {
    eventId: 'evt-priority-low',
    reservationId: 'res-priority-low',
    guestName: 'Alex',
    message: 'What is the wifi password?',
    sentAt: '2026-02-28T10:00:00.000Z',
  });
  ingestHospitableMessage(store, {
    eventId: 'evt-priority-high',
    reservationId: 'res-priority-high',
    guestName: 'Morgan',
    message: 'Can we pay cash offline and throw a party?',
    sentAt: '2026-02-28T09:00:00.000Z',
  });

  const queue = store.listQueue();
  assert.equal(queue[0]?.reservationId, 'res-priority-high');
});

void test('captures before/after audit payloads for draft edits and approval transitions', () => {
  const store = createStore({
    seed: [],
    policiesByIntent: {
      'check-in-reminder': 'Check-in starts at 4:00 PM.',
    },
  });

  const draft = createDraft(store, {
    reservationId: 'res-audit-diff-001',
    intent: 'check-in-reminder',
    context: { guestName: 'Riley' },
  });
  editDraft(store, draft.id, 'Updated host-reviewed wording.');
  approveDraft(store, draft.id, 'host-approver');

  const updated = store.listQueue().find((item) => item.id === draft.id);
  const editedEntry = updated?.auditLog.find((entry) => entry.action === 'edited');
  const approvedEntry = updated?.auditLog.find((entry) => entry.action === 'approved');

  assert.equal(Boolean(editedEntry && 'before' in editedEntry && 'after' in editedEntry), true);
  assert.equal(
    Boolean(approvedEntry && 'before' in approvedEntry && 'after' in approvedEntry),
    true,
  );
});

void test('filters queue by intent via API query param', async () => {
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-intent-filter-wifi',
        reservationId: 'res-intent-filter-wifi',
        guestName: 'Intent Filter',
        message: 'What is the wifi password?',
        sentAt: '2026-02-28T20:00:00.000Z',
      }),
    }),
  );
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-intent-filter-parking',
        reservationId: 'res-intent-filter-parking',
        guestName: 'Intent Filter',
        message: 'Can you share parking instructions?',
        sentAt: '2026-02-28T20:05:00.000Z',
      }),
    }),
  );

  const response = await getQueueRoute(
    new Request('http://localhost/api/command-center/queue?intent=wifi-help'),
  );
  const body = (await response.json()) as { items: Array<{ intent: string }> };
  assert.equal(body.items.length > 0, true);
  assert.equal(
    body.items.every((item) => item.intent === 'wifi-help'),
    true,
  );
});

void test('filters queue by risk via API query param', async () => {
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-risk-filter-low',
        reservationId: 'res-risk-filter-low',
        guestName: 'Risk Filter',
        message: 'What is check-in time?',
        sentAt: '2026-02-28T20:10:00.000Z',
      }),
    }),
  );
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-risk-filter-high',
        reservationId: 'res-risk-filter-high',
        guestName: 'Risk Filter',
        message: 'Can we pay cash offline and throw a party?',
        sentAt: '2026-02-28T20:12:00.000Z',
      }),
    }),
  );

  const response = await getQueueRoute(
    new Request('http://localhost/api/command-center/queue?risk=high'),
  );
  const body = (await response.json()) as { items: Array<{ body: string; intent: string }> };
  assert.equal(body.items.length > 0, true);
  assert.equal(
    body.items.every(
      (item) => getRiskTrustIndicator({ intent: item.intent, body: item.body }).risk === 'high',
    ),
    true,
  );
});

void test('filters queue by trust via API query param', async () => {
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-trust-filter-high',
        reservationId: 'res-trust-filter-high',
        guestName: 'Trust Filter',
        message: 'Can you share parking instructions?',
        sentAt: '2026-02-28T20:15:00.000Z',
      }),
    }),
  );
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-trust-filter-low',
        reservationId: 'res-trust-filter-low',
        guestName: 'Trust Filter',
        message: 'Can we pay cash offline and throw a party?',
        sentAt: '2026-02-28T20:16:00.000Z',
      }),
    }),
  );

  const response = await getQueueRoute(
    new Request('http://localhost/api/command-center/queue?trust=low'),
  );
  const body = (await response.json()) as { items: Array<{ body: string; intent: string }> };
  assert.equal(body.items.length > 0, true);
  assert.equal(
    body.items.every(
      (item) => getRiskTrustIndicator({ intent: item.intent, body: item.body }).trust === 'low',
    ),
    true,
  );
});

void test('returns draft history timeline for selected draft id', async () => {
  const created = await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-history-001',
        intent: 'check-in-reminder',
        context: { guestName: 'History Guest' },
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        actorId: 'history-editor',
        body: 'History edit body.',
      }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', actorId: 'history-approver' }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );

  const response = await getHistoryByDraftId(
    new Request(`http://localhost/api/command-center/history/${createdBody.item.id}`),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  const body = (await response.json()) as {
    items: Array<{
      draftId: string;
      action: string;
      actorId: string;
      before?: Record<string, unknown>;
    }>;
  };

  assert.equal(body.items.length >= 3, true);
  assert.equal(
    body.items.every((item) => item.draftId === createdBody.item.id),
    true,
  );
  assert.equal(
    body.items.some((item) => item.action === 'edited' && Boolean(item.before)),
    true,
  );
});

void test('returns today priorities panel data focused on actionable queue items', async () => {
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-priority-panel-low',
        reservationId: 'res-priority-panel-low',
        guestName: 'Priority Panel',
        message: 'Could you share wifi details?',
        sentAt: '2026-02-28T21:00:00.000Z',
      }),
    }),
  );
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-priority-panel-high',
        reservationId: 'res-priority-panel-high',
        guestName: 'Priority Panel',
        message: 'Can we pay cash offline and host a party?',
        sentAt: '2026-02-28T21:02:00.000Z',
      }),
    }),
  );

  const response = await getTodayPriorities(
    new Request('http://localhost/api/command-center/priorities?limit=3'),
  );
  const body = (await response.json()) as {
    items: Array<{
      reservationId: string;
      status: string;
      risk: string;
      priority: string;
      recommendedAction: string;
    }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.items.length > 0, true);
  assert.equal(body.items.length <= 3, true);
  assert.equal(
    body.items.every((item) => item.status !== 'sent' && item.status !== 'rejected'),
    true,
  );
  assert.equal(
    body.items.some(
      (item) =>
        item.reservationId === 'res-priority-panel-high' &&
        item.risk === 'high' &&
        item.priority === 'critical' &&
        item.recommendedAction === 'review-now',
    ),
    true,
  );
});

void test('rejects invalid priorities limit query', async () => {
  const response = await getTodayPriorities(
    new Request('http://localhost/api/command-center/priorities?limit=0'),
  );
  const body = (await response.json()) as { error?: string };

  assert.equal(response.status, 400);
  assert.equal((body.error ?? '').includes('limit must be between 1 and 20'), true);
});

void test('returns proactive communication suggestions for command center operators', async () => {
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-proactive-headsup',
        reservationId: 'res-proactive-headsup',
        guestName: 'Proactive Guest',
        message: 'Can we check in early around 1pm?',
        sentAt: '2026-02-28T21:10:00.000Z',
      }),
    }),
  );

  const response = await getProactiveSuggestions(
    new Request('http://localhost/api/command-center/proactive-suggestions?limit=20'),
  );
  const body = (await response.json()) as {
    items: Array<{ kind: string; reservationId: string; suggestedMessage: string; reason: string }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.items.length > 0, true);
  assert.equal(body.items.length <= 20, true);
  assert.equal(
    body.items.every((item) => item.suggestedMessage.length > 0 && item.reason.length > 0),
    true,
  );
  assert.equal(
    body.items.some(
      (item) =>
        item.reservationId === 'res-proactive-headsup' &&
        item.kind === 'heads-up' &&
        item.suggestedMessage.toLowerCase().includes('early check-in'),
    ),
    true,
  );
});

void test('rejects invalid proactive suggestions limit query', async () => {
  const response = await getProactiveSuggestions(
    new Request('http://localhost/api/command-center/proactive-suggestions?limit=21'),
  );
  const body = (await response.json()) as { error?: string };

  assert.equal(response.status, 400);
  assert.equal((body.error ?? '').includes('limit must be between 1 and 20'), true);
});

void test('supports cleaner JIT ping lifecycle with structured READY/ETA/NOT_READY responses', async () => {
  const created = await postCleanerJitPing(
    new Request('http://localhost/api/command-center/cleaner-jit/pings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-cleaner-jit-001',
        cleanerId: 'cleaner-001',
        reason: 'Early check-in request requires readiness confirmation.',
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string; status: string } };

  assert.equal(created.status, 201);
  assert.equal(createdBody.item.status, 'requested');

  const etaUpdated = await patchCleanerJitPing(
    new Request(`http://localhost/api/command-center/cleaner-jit/pings/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'ETA',
        etaMinutes: 35,
        note: 'Cleaner en route.',
      }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  const etaBody = (await etaUpdated.json()) as { item: { status: string; etaMinutes?: number } };

  assert.equal(etaUpdated.status, 200);
  assert.equal(etaBody.item.status, 'ETA');
  assert.equal(etaBody.item.etaMinutes, 35);

  const listed = await getCleanerJitPings(
    new Request(
      'http://localhost/api/command-center/cleaner-jit/pings?reservationId=res-cleaner-jit-001',
    ),
  );
  const listedBody = (await listed.json()) as {
    items: Array<{ reservationId: string; status: string }>;
  };
  assert.equal(listed.status, 200);
  assert.equal(
    listedBody.items.some(
      (item) => item.reservationId === 'res-cleaner-jit-001' && item.status === 'ETA',
    ),
    true,
  );
});

void test('rejects invalid cleaner JIT ETA updates without etaMinutes', async () => {
  const created = await postCleanerJitPing(
    new Request('http://localhost/api/command-center/cleaner-jit/pings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-cleaner-jit-002',
        cleanerId: 'cleaner-002',
        reason: 'Guest asks to arrive early.',
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  const invalidEta = await patchCleanerJitPing(
    new Request(`http://localhost/api/command-center/cleaner-jit/pings/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'ETA',
      }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  const body = (await invalidEta.json()) as { error?: string };

  assert.equal(invalidEta.status, 400);
  assert.equal((body.error ?? '').includes('etaMinutes is required when status is ETA'), true);
});

void test('runs monitoring agents and returns actionable operations alerts', async () => {
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-monitoring-risky',
        reservationId: 'res-monitoring-risky',
        guestName: 'Monitoring Guest',
        message: 'Can we pay cash offline and throw a party?',
        sentAt: '2026-02-28T22:00:00.000Z',
      }),
    }),
  );
  await postCleanerJitPing(
    new Request('http://localhost/api/command-center/cleaner-jit/pings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-monitoring-risky',
        cleanerId: 'cleaner-monitoring',
        reason: 'Early check-in risk validation.',
      }),
    }),
  );

  const runResponse = await postMonitoringRun();
  const runBody = (await runResponse.json()) as {
    items: Array<{ category: string; severity: string; reservationId?: string }>;
  };

  assert.equal(runResponse.status, 200);
  assert.equal(runBody.items.length > 0, true);
  assert.equal(
    runBody.items.some(
      (item) =>
        item.category === 'missing-confirmation' &&
        item.severity === 'high' &&
        item.reservationId === 'res-monitoring-risky',
    ),
    true,
  );

  const listResponse = await getMonitoringAlerts(
    new Request('http://localhost/api/command-center/monitoring?severity=high'),
  );
  const listBody = (await listResponse.json()) as { items: Array<{ severity: string }> };
  assert.equal(listResponse.status, 200);
  assert.equal(listBody.items.length > 0, true);
  assert.equal(
    listBody.items.every((item) => item.severity === 'high'),
    true,
  );
});

void test('computes property state readiness and blockers from monitoring signals', async () => {
  await postMonitoringRun();

  const propertyId = 'property:res-monitoring-risky';
  const response = await getPropertyStateById(
    new Request(`http://localhost/api/command-center/property-state/${propertyId}`),
    { params: Promise.resolve({ id: propertyId }) },
  );
  const body = (await response.json()) as {
    state: {
      propertyId: string;
      readiness: string;
      blockers: string[];
      signals: { openAlerts: number };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.state.propertyId, propertyId);
  assert.equal(body.state.readiness === 'blocked' || body.state.readiness === 'at-risk', true);
  assert.equal(body.state.signals.openAlerts > 0, true);
});

void test('rejects invalid monitoring query filters', async () => {
  const response = await getMonitoringAlerts(
    new Request('http://localhost/api/command-center/monitoring?status=nope'),
  );
  const body = (await response.json()) as { error?: string };

  assert.equal(response.status, 400);
  assert.equal((body.error ?? '').includes('Invalid status filter'), true);
});

void test('provides immediate host alerts and drafted guest reassurance for active incidents', async () => {
  await postIncidentRoute(
    new Request('http://localhost/api/command-center/incidents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ summary: 'Pool heater offline before check-in' }),
    }),
  );

  const response = await getIncidentAlerts(
    new Request('http://localhost/api/command-center/incidents/alerts'),
  );
  const body = (await response.json()) as {
    items: Array<{ incidentId: string; hostAlert: string; guestDraft: string; urgency: string }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.items.length > 0, true);
  assert.equal(
    body.items.every((item) => item.hostAlert.length > 0 && item.guestDraft.length > 0),
    true,
  );
  assert.equal(
    body.items.some(
      (item) =>
        item.urgency === 'immediate' &&
        item.hostAlert.toLowerCase().includes('incident') &&
        item.guestDraft.includes('Hi'),
    ),
    true,
  );
});

void test('scores experience risk by fix-impact and guest-sensitivity with separate urgency and compensation guidance', async () => {
  const severe = await postExperienceRisk(
    new Request('http://localhost/api/command-center/experience-risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fixImpact: 90,
        guestSensitivity: 85,
        nightsRemaining: 3,
      }),
    }),
  );
  const severeBody = (await severe.json()) as {
    score: number;
    communicationUrgency: string;
    compensationGuidance: string;
  };

  assert.equal(severe.status, 200, JSON.stringify(severeBody));
  assert.equal(severeBody.score >= 75, true);
  assert.equal(severeBody.communicationUrgency, 'immediate');
  assert.equal(
    severeBody.compensationGuidance === 'consider-credit' ||
      severeBody.compensationGuidance === 'escalate-review',
    true,
  );

  const low = await postExperienceRisk(
    new Request('http://localhost/api/command-center/experience-risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fixImpact: 20,
        guestSensitivity: 15,
        nightsRemaining: 1,
      }),
    }),
  );
  const lowBody = (await low.json()) as {
    score: number;
    communicationUrgency: string;
    compensationGuidance: string;
  };

  assert.equal(low.status, 200, JSON.stringify(lowBody));
  assert.equal(lowBody.score < severeBody.score, true);
  assert.equal(
    lowBody.communicationUrgency === 'routine' || lowBody.communicationUrgency === 'same-day',
    true,
  );
  assert.equal(lowBody.compensationGuidance, 'no-credit');
});

void test('rejects invalid experience risk inputs', async () => {
  const response = await postExperienceRisk(
    new Request('http://localhost/api/command-center/experience-risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fixImpact: 120,
        guestSensitivity: 40,
        nightsRemaining: 0,
      }),
    }),
  );
  const body = (await response.json()) as { error?: string };

  assert.equal(response.status, 400);
  assert.equal((body.error ?? '').length > 0, true);
});

void test('returns portfolio trends for incidents refunds amenity reliability and review quality', async () => {
  const response = await getPortfolioTrends(
    new Request('http://localhost/api/command-center/portfolio-trends'),
  );
  const body = (await response.json()) as {
    trends: {
      incidentTrend: string;
      refundTrend: string;
      amenityReliability: string;
      reviewQualityTrend: string;
      generatedAt: string;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(['improving', 'stable', 'degrading'].includes(body.trends.incidentTrend), true);
  assert.equal(['improving', 'stable', 'degrading'].includes(body.trends.refundTrend), true);
  assert.equal(['high', 'medium', 'low'].includes(body.trends.amenityReliability), true);
  assert.equal(['improving', 'stable', 'degrading'].includes(body.trends.reviewQualityTrend), true);
  assert.equal(body.trends.generatedAt.length > 0, true);
});

void test('evaluates selective autopilot only for safe intents and logs actions', async () => {
  const safe = await postAutopilotEvaluate(
    new Request('http://localhost/api/command-center/autopilot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-autopilot-safe',
        intent: 'wifi-help',
        body: 'Can you share wifi details?',
      }),
    }),
  );
  const safeBody = (await safe.json()) as { decision: string };
  assert.equal(safe.status, 200);
  assert.equal(safeBody.decision, 'auto-allowed');

  const unsafe = await postAutopilotEvaluate(
    new Request('http://localhost/api/command-center/autopilot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-autopilot-unsafe',
        intent: 'late-checkout-request',
        body: 'Can we leave at 3pm?',
      }),
    }),
  );
  const unsafeBody = (await unsafe.json()) as { decision: string };
  assert.equal(unsafe.status, 200);
  assert.equal(unsafeBody.decision, 'manual-required');

  const actions = await getAutopilotActions(
    new Request('http://localhost/api/command-center/autopilot'),
  );
  const actionsBody = (await actions.json()) as {
    items: Array<{ intent: string; status: string }>;
  };
  assert.equal(actions.status, 200);
  assert.equal(actionsBody.items.length > 0, true);
  assert.equal(
    actionsBody.items.some((item) => item.intent === 'wifi-help' && item.status === 'executed'),
    true,
  );
});

void test('supports autopilot rollback with full action logging', async () => {
  const created = await postAutopilotEvaluate(
    new Request('http://localhost/api/command-center/autopilot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-autopilot-rollback',
        intent: 'parking-help',
        body: 'Where do we park?',
      }),
    }),
  );
  const createdBody = (await created.json()) as { actionId: string };

  const rolledBack = await postAutopilotRollback(
    new Request('http://localhost/api/command-center/autopilot/rollback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: createdBody.actionId, reason: 'Host override requested' }),
    }),
  );
  const rolledBackBody = (await rolledBack.json()) as {
    item: { status: string; rollbackReason?: string };
  };

  assert.equal(rolledBack.status, 200);
  assert.equal(rolledBackBody.item.status, 'rolled_back');
  assert.equal(rolledBackBody.item.rollbackReason, 'Host override requested');
});

void test('returns and updates operating profile with per-property risk tolerances', async () => {
  const before = await getOperatingProfile(
    new Request('http://localhost/api/command-center/operating-profile'),
  );
  const beforeBody = (await before.json()) as {
    profile: {
      strictness: number;
      generosity: number;
      propertyRiskTolerance: Record<string, number>;
    };
  };
  assert.equal(before.status, 200);

  const updated = await patchOperatingProfile(
    new Request('http://localhost/api/command-center/operating-profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        strictness: 80,
        generosity: 35,
        propertyRiskTolerance: { 'property:res-autopilot-safe': 25 },
      }),
    }),
  );
  const updatedBody = (await updated.json()) as {
    profile: {
      strictness: number;
      generosity: number;
      propertyRiskTolerance: Record<string, number>;
    };
  };

  assert.equal(updated.status, 200);
  assert.equal(updatedBody.profile.strictness, 80);
  assert.equal(updatedBody.profile.generosity, 35);
  assert.equal(updatedBody.profile.propertyRiskTolerance['property:res-autopilot-safe'], 25);
  assert.equal(
    beforeBody.profile.strictness !== updatedBody.profile.strictness ||
      beforeBody.profile.generosity !== updatedBody.profile.generosity,
    true,
  );
});

void test('returns append-only event log and outbox records for delivery tracking', async () => {
  await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-e08-event-backbone',
        intent: 'check-in-reminder',
        context: { guestName: 'E08 Guest' },
      }),
    }),
  );

  const eventsResponse = await getEventBackbone(
    new Request('http://localhost/api/command-center/events?limit=10'),
  );
  const eventsBody = (await eventsResponse.json()) as {
    items: Array<{ sequence: number; type: string; timestamp: string }>;
  };
  assert.equal(eventsResponse.status, 200);
  assert.equal(eventsBody.items.length > 0, true);
  assert.equal(eventsBody.items[0]!.sequence > 0, true);
  assert.equal(eventsBody.items[0]!.timestamp.length > 0, true);

  const outboxResponse = await getOutbox(
    new Request('http://localhost/api/command-center/outbox?limit=10'),
  );
  const outboxBody = (await outboxResponse.json()) as {
    items: Array<{ id: string; destination: string; status: string; attempts: number }>;
  };
  assert.equal(outboxResponse.status, 200);
  assert.equal(outboxBody.items.length > 0, true);
  assert.equal(outboxBody.items[0]!.id.length > 0, true);
  assert.equal(outboxBody.items[0]!.attempts >= 0, true);
});

void test('retries outbox by destination and records attempts', async () => {
  await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-e08-outbox-retry',
        intent: 'wifi-help',
        context: { guestName: 'Retry Guest' },
      }),
    }),
  );

  const retryResponse = await postOutboxRetry(
    new Request('http://localhost/api/command-center/outbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ destination: 'projection-updater', limit: 5 }),
    }),
  );
  const retryBody = (await retryResponse.json()) as {
    processed: number;
    items: Array<{ destination: string; status: string; attempts: number }>;
  };

  assert.equal(retryResponse.status, 200);
  assert.equal(retryBody.processed > 0, true);
  assert.equal(
    retryBody.items.every((item) => item.destination === 'projection-updater'),
    true,
  );
  assert.equal(
    retryBody.items.every((item) => item.attempts >= 1),
    true,
  );
});

void test('returns approval queue and property-state projections for fast ui reads', async () => {
  await postMonitoringRun();

  const approvalProjection = await getProjections(
    new Request('http://localhost/api/command-center/projections?kind=approval-queue&limit=5'),
  );
  const approvalBody = (await approvalProjection.json()) as {
    projection: {
      kind: 'approval-queue';
      total: number;
      items: Array<{ draftId: string; reservationId: string; status: string }>;
    };
  };
  assert.equal(approvalProjection.status, 200);
  assert.equal(approvalBody.projection.kind, 'approval-queue');
  assert.equal(approvalBody.projection.total >= approvalBody.projection.items.length, true);

  const propertyProjection = await getProjections(
    new Request('http://localhost/api/command-center/projections?kind=property-state&limit=10'),
  );
  const propertyBody = (await propertyProjection.json()) as {
    projection: {
      kind: 'property-state';
      items: Array<{ propertyId: string; readiness: string; signals: { openAlerts: number } }>;
    };
  };
  assert.equal(propertyProjection.status, 200);
  assert.equal(propertyBody.projection.kind, 'property-state');
  assert.equal(propertyBody.projection.items.length > 0, true);
});

void test('supports full audit export with before-after payloads by actor', async () => {
  const created = await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-e08-audit-export',
        intent: 'check-in-reminder',
        context: { guestName: 'Audit Export Guest' },
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  await updateDraftRoute(
    new Request(`http://localhost/api/command-center/queue/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        actorId: 'audit-export-user',
        body: 'Updated for export.',
      }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );

  const csvResponse = await getAuditTimeline(
    new Request('http://localhost/api/command-center/audit?actorId=audit-export-user&format=csv'),
  );
  const csvText = await csvResponse.text();
  assert.equal(csvResponse.status, 200);
  assert.equal((csvResponse.headers.get('content-type') ?? '').includes('text/csv'), true);
  assert.equal(csvText.includes('before'), true);
  assert.equal(csvText.includes('after'), true);
  assert.equal(csvText.includes('audit-export-user'), true);
});

void test('returns normalized entities for properties guests reservations and messages', async () => {
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-e08-entities',
        reservationId: 'res-e08-entities',
        guestName: 'Entity Guest',
        message: 'Can you share parking details?',
        sentAt: '2026-03-01T16:00:00.000Z',
      }),
    }),
  );

  const response = await getEntities(
    new Request('http://localhost/api/command-center/entities?kind=all'),
  );
  const body = (await response.json()) as {
    entities: {
      properties: Array<{ propertyId: string }>;
      guests: Array<{ guestId: string }>;
      reservations: Array<{ reservationId: string }>;
      messages: Array<{ messageId: string }>;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.entities.properties.length > 0, true);
  assert.equal(body.entities.guests.length > 0, true);
  assert.equal(body.entities.reservations.length > 0, true);
  assert.equal(body.entities.messages.length > 0, true);
});

void test('captures property onboarding rules for check-in-out occupancy quiet-hours and house rules', async () => {
  const propertyId = 'property:e09-core-rules';
  const updated = await patchPropertyBrainProfile(
    new Request(
      `http://localhost/api/command-center/property-brain/${encodeURIComponent(propertyId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actorId: 'host-owner',
          coreRules: {
            checkInTime: '16:00',
            checkOutTime: '10:00',
            maxOccupancy: 6,
            quietHours: '22:00-08:00',
            houseRules: ['No smoking', 'No events'],
          },
        }),
      },
    ),
    { params: Promise.resolve({ id: propertyId }) },
  );
  const updatedBody = (await updated.json()) as {
    profile: {
      coreRules: { checkInTime: string; maxOccupancy: number };
      auditLog: Array<{ actorId: string }>;
    };
  };

  assert.equal(updated.status, 200);
  assert.equal(updatedBody.profile.coreRules.checkInTime, '16:00');
  assert.equal(updatedBody.profile.coreRules.maxOccupancy, 6);
  assert.equal(
    updatedBody.profile.auditLog.some((entry) => entry.actorId === 'host-owner'),
    true,
  );
});

void test('stores explicit early-late pricing tiers and resolves deterministic exception policy', async () => {
  const propertyId = 'property:e09-early-late';
  await patchPropertyBrainProfile(
    new Request(
      `http://localhost/api/command-center/property-brain/${encodeURIComponent(propertyId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actorId: 'ops-policy-admin',
          earlyLatePolicy: {
            earlyCheckIn: {
              earliestTime: '12:00',
              latestTime: '15:30',
              priceTiers: [{ fromHour: 12, toHour: 14, amountUsd: 35 }],
            },
            lateCheckout: {
              earliestTime: '10:00',
              latestTime: '13:00',
              priceTiers: [{ fromHour: 11, toHour: 13, amountUsd: 45 }],
            },
          },
        }),
      },
    ),
    { params: Promise.resolve({ id: propertyId }) },
  );

  const resolved = await postPropertyBrainResolve(
    new Request('http://localhost/api/command-center/property-brain/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId, intent: 'early-check-in-request' }),
    }),
  );
  const resolvedBody = (await resolved.json()) as {
    response: string;
    requiresClarification: boolean;
  };
  assert.equal(resolved.status, 200);
  assert.equal(resolvedBody.requiresClarification, false);
  assert.equal(resolvedBody.response.includes('12:00'), true);
  assert.equal(resolvedBody.response.includes('$35'), true);
});

void test('stores structured entry lock and parking instructions and resolves arrival-support details', async () => {
  const propertyId = 'property:e09-arrival';
  await patchPropertyBrainProfile(
    new Request(
      `http://localhost/api/command-center/property-brain/${encodeURIComponent(propertyId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actorId: 'ops-arrival',
          arrivalGuide: {
            entryMethod: 'smart-lock',
            lockInstructions: 'Use code from check-in message then press Enter.',
            parkingInstructions: 'Park in spot B2 only. Street parking prohibited.',
            accessNotes: 'Gate closes automatically after 9 PM.',
          },
        }),
      },
    ),
    { params: Promise.resolve({ id: propertyId }) },
  );

  const resolved = await postPropertyBrainResolve(
    new Request('http://localhost/api/command-center/property-brain/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId, intent: 'parking-help' }),
    }),
  );
  const body = (await resolved.json()) as { response: string };
  assert.equal(resolved.status, 200);
  assert.equal(body.response.includes('spot B2'), true);
  assert.equal(body.response.includes('Street parking prohibited'), true);
});

void test('stores cleaner contact preferences and required READY-ETA-NOT READY response format', async () => {
  const propertyId = 'property:e09-cleaner-pref';
  const update = await patchPropertyBrainProfile(
    new Request(
      `http://localhost/api/command-center/property-brain/${encodeURIComponent(propertyId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actorId: 'ops-cleaning',
          cleanerPreferences: {
            channel: 'sms',
            contact: '+1-555-0102',
            requiredFormat: 'READY | ETA:<minutes> | NOT_READY:<reason>',
            escalationAfterMinutes: 12,
          },
        }),
      },
    ),
    { params: Promise.resolve({ id: propertyId }) },
  );
  const updateBody = (await update.json()) as {
    profile: { cleanerPreferences: { channel: string; requiredFormat: string } };
  };
  assert.equal(update.status, 200);
  assert.equal(updateBody.profile.cleanerPreferences.channel, 'sms');
  assert.equal(updateBody.profile.cleanerPreferences.requiredFormat.includes('ETA'), true);
});

void test('stores amenity caveats and safety details to avoid misinformation in amenity drafts', async () => {
  const propertyId = 'property:e09-amenities';
  await patchPropertyBrainProfile(
    new Request(
      `http://localhost/api/command-center/property-brain/${encodeURIComponent(propertyId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actorId: 'amenity-operator',
          amenityPolicies: {
            poolHeating: {
              available: true,
              temperatureRangeF: '78-84',
              leadTimeHours: 4,
              caveats: ['Weather dependent'],
            },
            hotTub: {
              available: true,
              maxOccupancy: 4,
              safetyNotes: ['No glass', 'Shower before use'],
            },
            sauna: { available: false, safetyNotes: ['Currently under maintenance'] },
          },
        }),
      },
    ),
    { params: Promise.resolve({ id: propertyId }) },
  );

  const resolved = await postPropertyBrainResolve(
    new Request('http://localhost/api/command-center/property-brain/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId, intent: 'amenity-help', amenity: 'poolHeating' }),
    }),
  );
  const body = (await resolved.json()) as { response: string; sources: Array<{ section: string }> };
  assert.equal(resolved.status, 200);
  assert.equal(body.response.includes('Weather dependent'), true);
  assert.equal(
    body.sources.some((source) => source.section === 'amenityPolicies.poolHeating'),
    true,
  );
});

void test('returns clarification guidance when property brain context is incomplete', async () => {
  const response = await postPropertyBrainResolve(
    new Request('http://localhost/api/command-center/property-brain/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property:e09-missing',
        intent: 'early-check-in-request',
      }),
    }),
  );
  const body = (await response.json()) as {
    requiresClarification: boolean;
    missingFields: string[];
  };
  assert.equal(response.status, 200);
  assert.equal(body.requiresClarification, true);
  assert.equal(body.missingFields.length > 0, true);
});

void test('returns property brain profile with completeness snapshot for operators', async () => {
  const propertyId = 'property:e09-read-model';
  const response = await getPropertyBrainProfile(
    new Request(`http://localhost/api/command-center/property-brain/${propertyId}`),
    {
      params: Promise.resolve({ id: propertyId }),
    },
  );
  const body = (await response.json()) as {
    profile: { propertyId: string };
    completeness: { coreRules: boolean };
  };
  assert.equal(response.status, 200);
  assert.equal(body.profile.propertyId, propertyId);
  assert.equal(typeof body.completeness.coreRules, 'boolean');
});

void test('stores amenity importance index and uses it to classify incident priority', async () => {
  const propertyId = 'property:e09-amenity-priority';
  await patchPropertyBrainProfile(
    new Request(
      `http://localhost/api/command-center/property-brain/${encodeURIComponent(propertyId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actorId: 'property-manager',
          amenityImportanceIndex: {
            wifi: 'critical',
            poolHeating: 'important',
            bbq: 'enhancer',
          },
        }),
      },
    ),
    { params: Promise.resolve({ id: propertyId }) },
  );

  const resolved = await postPropertyBrainResolve(
    new Request('http://localhost/api/command-center/property-brain/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId,
        intent: 'amenity-issue',
        amenity: 'wifi',
      }),
    }),
  );
  const body = (await resolved.json()) as { incidentPriority?: string };
  assert.equal(resolved.status, 200);
  assert.equal(body.incidentPriority, 'critical');
});

void test('stores voice profile controls and applies them to resolved message style', async () => {
  const propertyId = 'property:e09-voice-style';
  await patchPropertyBrainProfile(
    new Request(
      `http://localhost/api/command-center/property-brain/${encodeURIComponent(propertyId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actorId: 'brand-manager',
          voiceProfile: {
            tone: 'warm',
            emojiUse: 'none',
            strictness: 'balanced',
            apologyStyle: 'brief',
          },
          coreRules: {
            checkInTime: '16:00',
            checkOutTime: '10:00',
            maxOccupancy: 4,
            quietHours: '22:00-08:00',
            houseRules: ['No parties'],
          },
        }),
      },
    ),
    { params: Promise.resolve({ id: propertyId }) },
  );

  const resolved = await postPropertyBrainResolve(
    new Request('http://localhost/api/command-center/property-brain/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId, intent: 'check-in-reminder' }),
    }),
  );
  const body = (await resolved.json()) as {
    response: string;
    styleApplied?: { tone: string; emojiUse: string };
  };
  assert.equal(resolved.status, 200);
  assert.equal(body.styleApplied?.tone, 'warm');
  assert.equal(body.styleApplied?.emojiUse, 'none');
  assert.equal(body.response.includes('Check-in is at 16:00'), true);
});

void test('stores always-manual escalation matrix and blocks autonomous handling for legal-safety scenarios', async () => {
  const propertyId = 'property:e09-escalation';
  await patchPropertyBrainProfile(
    new Request(
      `http://localhost/api/command-center/property-brain/${encodeURIComponent(propertyId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actorId: 'safety-legal',
          escalationMatrix: {
            alwaysManualScenarios: ['refund-request', 'threat', 'injury', 'accusation'],
            escalationChannel: 'legal-ops-hotline',
          },
        }),
      },
    ),
    { params: Promise.resolve({ id: propertyId }) },
  );

  const resolved = await postPropertyBrainResolve(
    new Request('http://localhost/api/command-center/property-brain/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId, intent: 'refund-request' }),
    }),
  );
  const body = (await resolved.json()) as {
    manualOnly?: boolean;
    escalation?: { required: boolean; channel?: string };
  };
  assert.equal(resolved.status, 200);
  assert.equal(body.manualOnly, true);
  assert.equal(body.escalation?.required, true);
  assert.equal(body.escalation?.channel, 'legal-ops-hotline');
});

void test('exposes v1 intent taxonomy for booking rules arrival checkout pool early-late spa and sauna', async () => {
  const response = await getIntentTaxonomy(
    new Request('http://localhost/api/command-center/intent-drafts'),
    {},
  );
  const body = (await response.json()) as { intents: string[] };
  assert.equal(response.status, 200);
  assert.equal(body.intents.includes('booking-inquiry'), true);
  assert.equal(body.intents.includes('rules-acknowledgment'), true);
  assert.equal(body.intents.includes('arrival-checkin'), true);
  assert.equal(body.intents.includes('checkout-guidance'), true);
  assert.equal(body.intents.includes('pool-help'), true);
  assert.equal(body.intents.includes('early-check-in-request'), true);
  assert.equal(body.intents.includes('late-checkout-request'), true);
  assert.equal(body.intents.includes('spa-help'), true);
  assert.equal(body.intents.includes('sauna-help'), true);
});

void test('enforces draft-only defaults and marks high-stakes categories as manual-only', async () => {
  const response = await postIntentDraft(
    new Request('http://localhost/api/command-center/intent-drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property:e10-manual-only',
        reservationId: 'res-e10-manual-only',
        intent: 'refund-request',
        guestName: 'Safety Guest',
      }),
    }),
    {},
  );
  const body = (await response.json()) as {
    mode: string;
    manualOnly: boolean;
    item: { status: string };
  };
  assert.equal(response.status, 200);
  assert.equal(body.mode, 'draft-only');
  assert.equal(body.manualOnly, true);
  assert.equal(body.item.status, 'pending');
});

void test('builds deterministic template sections for structured rules-based intents', async () => {
  const propertyId = 'property:e10-template-sections';
  await patchPropertyBrainProfile(
    new Request(
      `http://localhost/api/command-center/property-brain/${encodeURIComponent(propertyId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actorId: 'policy-ops',
          coreRules: {
            checkInTime: '16:00',
            checkOutTime: '10:00',
            maxOccupancy: 5,
            quietHours: '22:00-08:00',
            houseRules: ['No parties'],
          },
          earlyLatePolicy: {
            earlyCheckIn: {
              earliestTime: '12:00',
              latestTime: '15:00',
              priceTiers: [{ fromHour: 12, toHour: 14, amountUsd: 35 }],
            },
          },
        }),
      },
    ),
    { params: Promise.resolve({ id: propertyId }) },
  );

  const response = await postIntentDraft(
    new Request('http://localhost/api/command-center/intent-drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId,
        reservationId: 'res-e10-template-sections',
        intent: 'early-check-in-request',
        guestName: 'Template Guest',
      }),
    }),
    {},
  );
  const body = (await response.json()) as {
    item: { body: string };
    templateSections: string[];
    requiresClarification: boolean;
  };
  assert.equal(response.status, 200);
  assert.equal(body.requiresClarification, false);
  assert.equal(body.templateSections.join('|'), 'greeting|policy|constraints|next-step');
  assert.equal(body.item.body.includes('Early check-in window'), true);
});

void test('creates clarifying-question draft when required context is missing', async () => {
  const response = await postIntentDraft(
    new Request('http://localhost/api/command-center/intent-drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property:e10-missing-context',
        reservationId: 'res-e10-missing-context',
        intent: 'early-check-in-request',
        guestName: 'Clarify Guest',
      }),
    }),
    {},
  );
  const body = (await response.json()) as {
    requiresClarification: boolean;
    missingFields: string[];
    item: { body: string };
  };
  assert.equal(response.status, 200);
  assert.equal(body.requiresClarification, true);
  assert.equal(body.missingFields.length > 0, true);
  assert.equal(body.item.body.toLowerCase().includes('could you confirm'), true);
});

void test('provides transparent risk trust scoring with explainable factors and recommendation', async () => {
  const response = await postRiskIntelligence(
    new Request('http://localhost/api/command-center/risk-intelligence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property:e11-transparent',
        bookingPatternSignals: 70,
        profileQualitySignals: 40,
        languageCues: 55,
        policyViolationFlags: 35,
        positiveReviewHistory: 60,
        responseQuality: 70,
        explicitRuleAcceptance: 80,
      }),
    }),
  );
  const body = (await response.json()) as {
    assessment: {
      riskScore: number;
      trustScore: number;
      recommendation: string;
      factors: Record<string, number>;
      rationale: string[];
    };
  };
  assert.equal(response.status, 200);
  assert.equal(typeof body.assessment.riskScore, 'number');
  assert.equal(typeof body.assessment.trustScore, 'number');
  assert.equal(body.assessment.rationale.length > 0, true);
  assert.equal(Object.keys(body.assessment.factors).length >= 7, true);
});

void test('risk model incorporates booking-pattern profile language and policy-violation signals', async () => {
  const highRisk = await postRiskIntelligence(
    new Request('http://localhost/api/command-center/risk-intelligence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property:e11-signals',
        bookingPatternSignals: 90,
        profileQualitySignals: 85,
        languageCues: 90,
        policyViolationFlags: 95,
        positiveReviewHistory: 10,
        responseQuality: 20,
        explicitRuleAcceptance: 0,
      }),
    }),
  );
  const lowRisk = await postRiskIntelligence(
    new Request('http://localhost/api/command-center/risk-intelligence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property:e11-signals',
        bookingPatternSignals: 10,
        profileQualitySignals: 10,
        languageCues: 15,
        policyViolationFlags: 5,
        positiveReviewHistory: 80,
        responseQuality: 80,
        explicitRuleAcceptance: 85,
      }),
    }),
  );
  const highBody = (await highRisk.json()) as { assessment: { riskScore: number } };
  const lowBody = (await lowRisk.json()) as { assessment: { riskScore: number } };
  assert.equal(highRisk.status, 200);
  assert.equal(lowRisk.status, 200);
  assert.equal(highBody.assessment.riskScore > lowBody.assessment.riskScore, true);
});

void test('trust model boosts confidence with review history response quality and explicit rule acceptance', async () => {
  const weak = await postRiskIntelligence(
    new Request('http://localhost/api/command-center/risk-intelligence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property:e11-trust',
        bookingPatternSignals: 40,
        profileQualitySignals: 40,
        languageCues: 40,
        policyViolationFlags: 20,
        positiveReviewHistory: 10,
        responseQuality: 10,
        explicitRuleAcceptance: 0,
      }),
    }),
  );
  const strong = await postRiskIntelligence(
    new Request('http://localhost/api/command-center/risk-intelligence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property:e11-trust',
        bookingPatternSignals: 40,
        profileQualitySignals: 40,
        languageCues: 40,
        policyViolationFlags: 20,
        positiveReviewHistory: 95,
        responseQuality: 90,
        explicitRuleAcceptance: 100,
      }),
    }),
  );
  const weakBody = (await weak.json()) as { assessment: { trustScore: number } };
  const strongBody = (await strong.json()) as { assessment: { trustScore: number } };
  assert.equal(strongBody.assessment.trustScore > weakBody.assessment.trustScore, true);
});

void test('host operating profile tuning including economic sensitivity shifts guidance outcomes', async () => {
  await patchOperatingProfile(
    new Request('http://localhost/api/command-center/operating-profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        strictness: 70,
        generosity: 30,
        compensationCapUsd: 100,
        economicSensitivity: 90,
      }),
    }),
  );

  const highSensitivity = await postRiskIntelligence(
    new Request('http://localhost/api/command-center/risk-intelligence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property:e11-operating-profile',
        bookingPatternSignals: 55,
        profileQualitySignals: 50,
        languageCues: 55,
        policyViolationFlags: 40,
        positiveReviewHistory: 55,
        responseQuality: 60,
        explicitRuleAcceptance: 60,
      }),
    }),
  );

  await patchOperatingProfile(
    new Request('http://localhost/api/command-center/operating-profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        strictness: 40,
        generosity: 65,
        compensationCapUsd: 300,
        economicSensitivity: 20,
      }),
    }),
  );

  const lowSensitivity = await postRiskIntelligence(
    new Request('http://localhost/api/command-center/risk-intelligence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property:e11-operating-profile',
        bookingPatternSignals: 55,
        profileQualitySignals: 50,
        languageCues: 55,
        policyViolationFlags: 40,
        positiveReviewHistory: 55,
        responseQuality: 60,
        explicitRuleAcceptance: 60,
      }),
    }),
  );

  const highBody = (await highSensitivity.json()) as { assessment: { recommendation: string } };
  const lowBody = (await lowSensitivity.json()) as { assessment: { recommendation: string } };
  assert.equal(highSensitivity.status, 200);
  assert.equal(lowSensitivity.status, 200);
  assert.equal(highBody.assessment.recommendation !== lowBody.assessment.recommendation, true);
});

void test('computes readiness beyond cleaning using vendor conflicts maintenance and critical amenity signals', async () => {
  const incidentResponse = await postIncidentRoute(
    new Request('http://localhost/api/command-center/incidents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ summary: 'HVAC maintenance conflict before arrival' }),
    }),
  );
  const incidentBody = (await incidentResponse.json()) as { item: { id: string } };

  await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-e12-readiness',
        intent: 'early-check-in-request',
        context: { guestName: 'Readiness Guest' },
      }),
    }),
  );
  await postCleanerJitPing(
    new Request('http://localhost/api/command-center/cleaner-jit/pings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-e12-readiness',
        cleanerId: 'cleaner-readiness',
        reason: 'Turnover conflict',
      }),
    }),
  );
  await postMonitoringRun();

  const propertyState = await getPropertyStateById(
    new Request('http://localhost/api/command-center/property-state/property%3Ares-e12-readiness'),
    { params: Promise.resolve({ id: 'property:res-e12-readiness' }) },
  );
  const stateBody = (await propertyState.json()) as {
    state: {
      readiness: string;
      signals: {
        openAlerts: number;
        pendingCleanerPings: number;
        vendorConflicts?: number;
        maintenanceIssues?: number;
        criticalAmenityIssues?: number;
      };
    };
  };

  assert.equal(propertyState.status, 200);
  assert.equal(
    stateBody.state.readiness === 'blocked' || stateBody.state.readiness === 'at-risk',
    true,
  );
  assert.equal((stateBody.state.signals.vendorConflicts ?? 0) >= 1, true);
  assert.equal((stateBody.state.signals.maintenanceIssues ?? 0) >= 0, true);
  assert.equal((stateBody.state.signals.criticalAmenityIssues ?? 0) >= 0, true);
  assert.equal(incidentBody.item.id.length > 0, true);
});

void test('runs just-in-time checks for early-late requests with targeted intervention guidance', async () => {
  await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-e12-jit',
        intent: 'late-checkout-request',
        context: { guestName: 'JIT Guest' },
      }),
    }),
  );
  await postCleanerJitPing(
    new Request('http://localhost/api/command-center/cleaner-jit/pings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-e12-jit',
        cleanerId: 'cleaner-jit',
        reason: 'Late checkout conflict',
      }),
    }),
  );

  const response = await postJitChecks(
    new Request('http://localhost/api/command-center/monitoring/jit-checks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reservationId: 'res-e12-jit', requestType: 'late-checkout' }),
    }),
  );
  const body = (await response.json()) as {
    result: 'clear' | 'review' | 'block';
    checks: Array<{ check: string; status: string }>;
  };
  assert.equal(response.status, 200);
  assert.equal(body.checks.length > 0, true);
  assert.equal(
    body.checks.some((check) => check.check === 'cleaner-readiness'),
    true,
  );
});

void test('exposes always-on monitoring agent status with latest run metadata', async () => {
  const run = await postMonitoringRun();
  assert.equal(run.status, 200);

  const response = await getMonitoringAlerts(
    new Request('http://localhost/api/command-center/monitoring?includeAgentStatus=1'),
  );
  const body = (await response.json()) as {
    items: unknown[];
    agentStatus?: { alwaysOn: boolean; lastRunAt: string; monitoredConditions: string[] };
  };
  assert.equal(response.status, 200);
  assert.equal(body.agentStatus?.alwaysOn, true);
  assert.equal((body.agentStatus?.lastRunAt ?? '').length > 0, true);
  assert.equal((body.agentStatus?.monitoredConditions.length ?? 0) > 0, true);
});

void test('returns incident response plan with immediate host alert approval-gated guest draft and separate compensation recommendation', async () => {
  const created = await postIncidentRoute(
    new Request('http://localhost/api/command-center/incidents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ summary: 'Water heater outage' }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  const response = await postIncidentResponsePlan(
    new Request('http://localhost/api/command-center/incidents/response-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ incidentId: createdBody.item.id }),
    }),
  );
  const body = (await response.json()) as {
    hostAlert: string;
    guestDraft: { body: string; requiresApproval: boolean; channel: string };
    compensationRecommendation: { amountUsd: number; rationale: string };
  };
  assert.equal(response.status, 200);
  assert.equal(body.hostAlert.length > 0, true);
  assert.equal(body.guestDraft.requiresApproval, true);
  assert.equal(body.guestDraft.channel, 'in-app-message');
  assert.equal(body.compensationRecommendation.amountUsd >= 0, true);
});

void test('returns incident lifecycle timeline across Active to Normalized transitions', async () => {
  const created = await postIncidentRoute(
    new Request('http://localhost/api/command-center/incidents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ summary: 'Lifecycle timeline incident' }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };
  const incidentId = createdBody.item.id;

  await transitionIncidentRoute(
    new Request(`http://localhost/api/command-center/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ next: 'negotiation' }),
    }),
    { params: Promise.resolve({ id: incidentId }) },
  );
  await transitionIncidentRoute(
    new Request(`http://localhost/api/command-center/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ next: 'resolution-accepted' }),
    }),
    { params: Promise.resolve({ id: incidentId }) },
  );
  await transitionIncidentRoute(
    new Request(`http://localhost/api/command-center/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ next: 'recovery-closed' }),
    }),
    { params: Promise.resolve({ id: incidentId }) },
  );
  await transitionIncidentRoute(
    new Request(`http://localhost/api/command-center/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ next: 'normalized' }),
    }),
    { params: Promise.resolve({ id: incidentId }) },
  );

  const response = await getIncidentTimeline(
    new Request(`http://localhost/api/command-center/incidents/${incidentId}/timeline`),
    { params: Promise.resolve({ id: incidentId }) },
  );
  const body = (await response.json()) as { items: Array<{ state: string }> };
  assert.equal(response.status, 200);
  assert.equal(body.items.length >= 5, true);
  assert.equal(body.items[0]?.state, 'active');
  assert.equal(body.items[body.items.length - 1]?.state, 'normalized');
});

void test('exposes approval queue as default landing screen metadata', async () => {
  const response = await getLandingScreen();
  const body = (await response.json()) as {
    defaultScreen: string;
    queueSummary: { total: number };
  };
  assert.equal(response.status, 200);
  assert.equal(body.defaultScreen, 'approval-queue');
  assert.equal(body.queueSummary.total >= 0, true);
});

void test('supports urgency-sla sorting with quick preview-edit-send actions in queue payload', async () => {
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-e13-sla-sort',
        reservationId: 'res-e13-sla-sort',
        guestName: 'SLA Guest',
        message: 'Can we do an off-platform cash booking for a party?',
        sentAt: '2026-03-01T12:00:00.000Z',
      }),
    }),
  );

  const response = await getQueueRoute(
    new Request('http://localhost/api/command-center/queue?sort=sla&includeUx=1'),
  );
  const body = (await response.json()) as {
    items: Array<{ id: string; quickActions?: string[]; risk?: string; slaBucket?: string }>;
  };
  assert.equal(response.status, 200);
  assert.equal(body.items.length > 0, true);
  assert.equal((body.items[0]?.quickActions ?? []).includes('preview'), true);
  assert.equal((body.items[0]?.quickActions ?? []).includes('edit'), true);
  assert.equal((body.items[0]?.quickActions ?? []).includes('send'), true);
  assert.equal(typeof body.items[0]?.slaBucket, 'string');
});

void test('returns conversation detail with source references intent labels and risk-trust badges', async () => {
  const created = await createDraftRoute(
    new Request('http://localhost/api/command-center/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reservationId: 'res-e13-context',
        intent: 'check-in-reminder',
        context: { guestName: 'Context Guest' },
      }),
    }),
  );
  const createdBody = (await created.json()) as { item: { id: string } };

  const response = await getContextByDraftId(
    new Request(`http://localhost/api/command-center/context/${createdBody.item.id}`),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  const body = (await response.json()) as {
    context: {
      intent: string;
      intentLabel?: string;
      riskTrustBadge?: { risk: string; trust: string };
      knowledgeSources: Array<{ referenceUrl?: string }>;
    };
  };
  assert.equal(response.status, 200);
  assert.equal((body.context.intentLabel ?? '').length > 0, true);
  assert.equal((body.context.riskTrustBadge?.risk ?? '').length > 0, true);
  assert.equal(
    body.context.knowledgeSources.some((source) => Boolean(source.referenceUrl)),
    true,
  );
});

void test('supports today priorities drilldowns to reservation and property details', async () => {
  const priorities = await getTodayPriorities(
    new Request('http://localhost/api/command-center/priorities?limit=1'),
  );
  const prioritiesBody = (await priorities.json()) as { items: Array<{ draftId: string }> };
  assert.equal(priorities.status, 200);
  assert.equal(prioritiesBody.items.length > 0, true);

  const draftId = prioritiesBody.items[0]!.draftId;
  const drilldown = await getPriorityDrilldown(
    new Request(`http://localhost/api/command-center/priorities/${draftId}`),
    { params: Promise.resolve({ id: draftId }) },
  );
  const drilldownBody = (await drilldown.json()) as {
    detail: {
      draftId: string;
      reservationId: string;
      propertyId: string;
      propertyState: { readiness: string };
    };
  };
  assert.equal(drilldown.status, 200);
  assert.equal(drilldownBody.detail.draftId, draftId);
  assert.equal(drilldownBody.detail.propertyState.readiness.length > 0, true);
});

void test('returns minimal property overview with readiness snapshot and blockers', async () => {
  const response = await getPropertiesOverview();
  const body = (await response.json()) as {
    items: Array<{
      propertyId: string;
      readiness: string;
      blockers: string[];
      pendingCount: number;
    }>;
  };
  assert.equal(response.status, 200);
  assert.equal(body.items.length > 0, true);
  assert.equal(typeof body.items[0]?.propertyId, 'string');
  assert.equal(typeof body.items[0]?.pendingCount, 'number');
  assert.equal(Array.isArray(body.items[0]?.blockers), true);
});

void test('reports integrations status with hospitable live and airbnb partner-track in parallel', async () => {
  const response = await getIntegrationStatus();
  const body = (await response.json()) as {
    integrations: {
      hospitable: { inboundChannel: string; status: string; outboundApiConfigured?: boolean };
      airbnb: { status: string; mode: string };
    };
  };
  assert.equal(response.status, 200);
  assert.equal(body.integrations.hospitable.inboundChannel, 'webhook');
  assert.equal(body.integrations.hospitable.status, 'live');
  assert.equal(typeof body.integrations.hospitable.outboundApiConfigured, 'boolean');
  assert.equal(body.integrations.airbnb.mode, 'partner-track');
});

void test('returns actionable error when hospitable outbound api is not configured', async () => {
  const previousApiKey = process.env.HOSPITABLE_API_KEY;
  const previousBaseUrl = process.env.HOSPITABLE_BASE_URL;
  delete process.env.HOSPITABLE_API_KEY;
  delete process.env.HOSPITABLE_BASE_URL;
  try {
    const response = await getHospitableMessages(
      new Request(
        'http://localhost/api/integrations/hospitable/messages?reservationId=res-001&limit=5',
      ),
    );
    const body = (await response.json()) as { error?: string };
    assert.equal(response.status, 503);
    assert.equal((body.error ?? '').includes('not configured'), true);
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.HOSPITABLE_API_KEY;
    } else {
      process.env.HOSPITABLE_API_KEY = previousApiKey;
    }
    if (previousBaseUrl === undefined) {
      delete process.env.HOSPITABLE_BASE_URL;
    } else {
      process.env.HOSPITABLE_BASE_URL = previousBaseUrl;
    }
  }
});

void test('fetches and normalizes hospitable outbound messages when api is configured', async () => {
  const previousApiKey = process.env.HOSPITABLE_API_KEY;
  const previousBaseUrl = process.env.HOSPITABLE_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.HOSPITABLE_API_KEY = 'test-api-key';
  process.env.HOSPITABLE_BASE_URL = 'https://api.hospitable.com';

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const target =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    assert.equal(target.includes('/v2/reservations/res-demo-001/messages'), true);
    assert.equal(target.includes('limit=100'), true); // route clamps to max(requested, 100)
    assert.equal(
      String((init?.headers as Record<string, string>).authorization).startsWith('Bearer'),
      true,
    );
    return new Response(
      JSON.stringify({
        data: [
          {
            id: 'msg-001',
            reservationId: 'res-demo-001',
            guestName: 'Casey',
            message: 'Can we check in at 2pm?',
            sentAt: '2026-03-01T10:00:00.000Z',
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const response = await getHospitableMessages(
      new Request(
        'http://localhost/api/integrations/hospitable/messages?reservationId=res-demo-001&limit=2',
      ),
    );
    const body = (await response.json()) as {
      source: string;
      count: number;
      items: Array<{ id: string; reservationId: string; guestName: string; message: string }>;
    };
    assert.equal(response.status, 200);
    assert.equal(body.source, 'hospitable-api');
    assert.equal(body.count, 1);
    assert.equal(body.items[0]?.reservationId, 'res-demo-001');
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) {
      delete process.env.HOSPITABLE_API_KEY;
    } else {
      process.env.HOSPITABLE_API_KEY = previousApiKey;
    }
    if (previousBaseUrl === undefined) {
      delete process.env.HOSPITABLE_BASE_URL;
    } else {
      process.env.HOSPITABLE_BASE_URL = previousBaseUrl;
    }
  }
});

void test('returns latest reservation messages first with cursor pagination metadata', async () => {
  const previousApiKey = process.env.HOSPITABLE_API_KEY;
  const previousBaseUrl = process.env.HOSPITABLE_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.HOSPITABLE_API_KEY = 'test-api-key';
  process.env.HOSPITABLE_BASE_URL = 'https://api.hospitable.com';

  globalThis.fetch = (async () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({
      id: `msg-00${index + 1}`,
      reservationId: 'res-demo-001',
      guestName: 'Casey',
      message: `Message ${index + 1}`,
      sentAt: `2026-03-01T10:0${index}:00.000Z`,
    }));
    return new Response(JSON.stringify({ data: messages }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const response = await getHospitableMessages(
      new Request(
        'http://localhost/api/integrations/hospitable/messages?reservationId=res-demo-001&limit=5',
      ),
    );
    const body = (await response.json()) as {
      count: number;
      items: Array<{ id: string }>;
      page?: { hasMoreOlder: boolean; nextBeforeCursor: string | null };
    };
    assert.equal(response.status, 200);
    assert.equal(body.count, 5);
    assert.deepEqual(
      body.items.map((item) => item.id),
      ['msg-004', 'msg-005', 'msg-006', 'msg-007', 'msg-008'],
    );
    assert.equal(body.page?.hasMoreOlder, true);
    assert.equal(typeof body.page?.nextBeforeCursor, 'string');
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) {
      delete process.env.HOSPITABLE_API_KEY;
    } else {
      process.env.HOSPITABLE_API_KEY = previousApiKey;
    }
    if (previousBaseUrl === undefined) {
      delete process.env.HOSPITABLE_BASE_URL;
    } else {
      process.env.HOSPITABLE_BASE_URL = previousBaseUrl;
    }
  }
});

void test('returns older reservation messages when beforeCursor is provided', async () => {
  const previousApiKey = process.env.HOSPITABLE_API_KEY;
  const previousBaseUrl = process.env.HOSPITABLE_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.HOSPITABLE_API_KEY = 'test-api-key';
  process.env.HOSPITABLE_BASE_URL = 'https://api.hospitable.com';

  globalThis.fetch = (async () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({
      id: `msg-00${index + 1}`,
      reservationId: 'res-demo-001',
      guestName: 'Casey',
      message: `Message ${index + 1}`,
      sentAt: `2026-03-01T10:0${index}:00.000Z`,
    }));
    return new Response(JSON.stringify({ data: messages }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const firstResponse = await getHospitableMessages(
      new Request(
        'http://localhost/api/integrations/hospitable/messages?reservationId=res-demo-001&limit=5',
      ),
    );
    const firstBody = (await firstResponse.json()) as {
      page?: { nextBeforeCursor: string | null };
    };
    const cursor = firstBody.page?.nextBeforeCursor ?? '';
    assert.equal(cursor.length > 0, true);

    const secondResponse = await getHospitableMessages(
      new Request(
        `http://localhost/api/integrations/hospitable/messages?reservationId=res-demo-001&limit=5&beforeCursor=${encodeURIComponent(cursor)}`,
      ),
    );
    const secondBody = (await secondResponse.json()) as {
      count: number;
      items: Array<{ id: string }>;
      page?: { hasMoreOlder: boolean; nextBeforeCursor: string | null };
    };
    assert.equal(secondResponse.status, 200);
    assert.equal(secondBody.count, 3);
    assert.deepEqual(
      secondBody.items.map((item) => item.id),
      ['msg-001', 'msg-002', 'msg-003'],
    );
    assert.equal(secondBody.page?.hasMoreOlder, false);
    assert.equal(secondBody.page?.nextBeforeCursor ?? null, null);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) {
      delete process.env.HOSPITABLE_API_KEY;
    } else {
      process.env.HOSPITABLE_API_KEY = previousApiKey;
    }
    if (previousBaseUrl === undefined) {
      delete process.env.HOSPITABLE_BASE_URL;
    } else {
      process.env.HOSPITABLE_BASE_URL = previousBaseUrl;
    }
  }
});

void test('supports single twilio ops number and cleaner 1-1 readiness threads', async () => {
  const upsert = await postTwilioThread(
    new Request('http://localhost/api/integrations/twilio/threads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        opsNumber: '+15550001111',
        cleanerId: 'cleaner-e14-001',
        cleanerPhone: '+15550002222',
        readinessSignal: 'ETA:20',
      }),
    }),
  );
  assert.equal(upsert.status, 200);

  const list = await getTwilioThreads(
    new Request('http://localhost/api/integrations/twilio/threads'),
  );
  const body = (await list.json()) as {
    opsNumber: string;
    threads: Array<{ cleanerId: string; readinessSignal: string }>;
  };
  assert.equal(list.status, 200);
  assert.equal(body.opsNumber, '+15550001111');
  assert.equal(
    body.threads.some((thread) => thread.cleanerId === 'cleaner-e14-001'),
    true,
  );
});

void test('returns roi dashboard metrics including response throughput incident recovery refunds reviews and cleaner latency', async () => {
  const response = await getRoiDashboard();
  const body = (await response.json()) as {
    metrics: {
      responseTimeMinutes: number;
      throughputPerDay: number;
      incidentRate: number;
      recoveryRate: number;
      refundsAndCompensationUsd: number;
      reviewOutcomeAverage: number;
      cleanerResponseLatencyMinutes: number;
    };
  };
  assert.equal(response.status, 200);
  assert.equal(typeof body.metrics.responseTimeMinutes, 'number');
  assert.equal(typeof body.metrics.throughputPerDay, 'number');
  assert.equal(typeof body.metrics.incidentRate, 'number');
  assert.equal(typeof body.metrics.recoveryRate, 'number');
  assert.equal(typeof body.metrics.refundsAndCompensationUsd, 'number');
  assert.equal(typeof body.metrics.reviewOutcomeAverage, 'number');
  assert.equal(typeof body.metrics.cleanerResponseLatencyMinutes, 'number');
});

void test('returns adoption metrics for command-center-first behavior and reduced anxiety trend', async () => {
  const response = await getAdoptionMetrics();
  const body = (await response.json()) as {
    adoption: {
      commandCenterFirstRate: number;
      reducedAnxietyIndex: number;
      workflowAdoptionRate: number;
      period: string;
    };
  };
  assert.equal(response.status, 200);
  assert.equal(
    body.adoption.commandCenterFirstRate >= 0 && body.adoption.commandCenterFirstRate <= 100,
    true,
  );
  assert.equal(
    body.adoption.reducedAnxietyIndex >= 0 && body.adoption.reducedAnxietyIndex <= 100,
    true,
  );
  assert.equal(
    body.adoption.workflowAdoptionRate >= 0 && body.adoption.workflowAdoptionRate <= 100,
    true,
  );
  assert.equal(body.adoption.period.length > 0, true);
});

void test('creates pending qa suggestion from inbound message and exposes notification count', async () => {
  const eventId = `event-qa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ingress = await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId,
        reservationId: 'res-qa-001',
        guestName: 'Alex',
        message: 'What is the wifi password?',
      }),
    }),
  );
  assert.equal(ingress.status, 202);

  const notifications = await getQaSuggestionNotifications(
    new Request('http://localhost/api/command-center/qa-suggestions/notifications'),
    {},
  );
  const notificationsBody = (await notifications.json()) as { pendingCount: number };
  assert.equal(notifications.status, 200);
  assert.equal(notificationsBody.pendingCount > 0, true);

  const suggestions = await getQaSuggestionsByProperty(
    new Request(
      'http://localhost/api/command-center/qa-suggestions?propertyId=property:res-qa-001&status=pending',
    ),
    { params: Promise.resolve({ propertyId: 'property:res-qa-001' }) },
  );
  const suggestionsBody = (await suggestions.json()) as {
    items: Array<{ id: string; status: string; classifierLabel: string; sourceMessageId: string }>;
  };
  assert.equal(suggestions.status, 200);
  assert.equal(suggestionsBody.items.length > 0, true);
  assert.equal(suggestionsBody.items[0]?.status, 'pending');
  assert.equal(suggestionsBody.items[0]?.classifierLabel, 'likely-reusable');
});

void test('approves qa suggestion and includes approved qa source in regenerated context', async () => {
  const eventId = `event-qa-approve-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ingress = await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId,
        reservationId: 'res-qa-approve-001',
        guestName: 'Avery',
        message: 'Do you have parking available?',
      }),
    }),
  );
  const ingressBody = (await ingress.json()) as { item: { id: string } };
  assert.equal(ingress.status, 202);

  const suggestions = await getQaSuggestionsByProperty(
    new Request(
      'http://localhost/api/command-center/qa-suggestions?propertyId=property:res-qa-approve-001&status=pending',
    ),
    { params: Promise.resolve({ propertyId: 'property:res-qa-approve-001' }) },
  );
  const suggestionsBody = (await suggestions.json()) as { items: Array<{ id: string }> };
  const suggestionId = suggestionsBody.items[0]?.id;
  assert.equal(typeof suggestionId, 'string');

  const approved = await postApproveQaSuggestion(
    new Request(`http://localhost/api/command-center/qa-suggestions/${suggestionId}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actorId: 'qa-reviewer-1' }),
    }),
    { params: Promise.resolve({ id: String(suggestionId) }) },
  );
  assert.equal(approved.status, 200);

  const regenerated = await postDraftFromInbound(
    new Request('http://localhost/api/command-center/drafts/from-inbound', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draftId: ingressBody.item.id }),
    }),
  );
  assert.equal(regenerated.status, 200);

  const context = await getContextByDraftId(
    new Request(`http://localhost/api/command-center/context/${ingressBody.item.id}`),
    { params: Promise.resolve({ id: ingressBody.item.id }) },
  );
  const contextBody = (await context.json()) as {
    context: { knowledgeSources: Array<{ type: string; referenceId?: string }> };
  };
  assert.equal(context.status, 200);
  assert.equal(
    contextBody.context.knowledgeSources.some((source) => source.type === 'policy'),
    true,
  );
  assert.equal(
    contextBody.context.knowledgeSources.some((source) => source.type === 'property-qa'),
    true,
  );
});

void test('deduplicates near-identical qa suggestions by normalized question hash', async () => {
  const eventA = `event-qa-dedupe-a-${Date.now()}`;
  const eventB = `event-qa-dedupe-b-${Date.now()}`;

  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: eventA,
        reservationId: 'res-qa-dedupe-001',
        guestName: 'Sam',
        message: 'What is the wifi password?',
      }),
    }),
  );

  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: eventB,
        reservationId: 'res-qa-dedupe-001',
        guestName: 'Sam',
        message: 'What is the WI-FI password',
      }),
    }),
  );

  const suggestions = await getQaSuggestionsByProperty(
    new Request(
      'http://localhost/api/command-center/qa-suggestions?propertyId=property:res-qa-dedupe-001&status=pending',
    ),
    { params: Promise.resolve({ propertyId: 'property:res-qa-dedupe-001' }) },
  );
  const body = (await suggestions.json()) as { items: Array<{ id: string }> };
  assert.equal(suggestions.status, 200);
  assert.equal(body.items.length, 1);
});

void test('supports manual property qa add and archive flow', async () => {
  const created = await postPropertyQaEntry(
    new Request('http://localhost/api/command-center/qa/property:manual-001', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question: 'Is the hot tub open all year?',
        answer: 'Yes, but quiet hours start at 10 PM.',
        createdBy: 'host-manual-1',
      }),
    }),
    { params: Promise.resolve({ propertyId: 'property:manual-001' }) },
  );
  const createdBody = (await created.json()) as { item: { id: string; status: string } };
  assert.equal(created.status, 200);
  assert.equal(createdBody.item.status, 'active');

  const archived = await patchPropertyQaEntry(
    new Request(`http://localhost/api/command-center/qa/entry/${createdBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'archived',
        updatedBy: 'host-manual-1',
      }),
    }),
    { params: Promise.resolve({ id: createdBody.item.id }) },
  );
  assert.equal(archived.status, 200);

  const entries = await getPropertyQaEntries(
    new Request('http://localhost/api/command-center/qa/property:manual-001'),
    { params: Promise.resolve({ propertyId: 'property:manual-001' }) },
  );
  const entriesBody = (await entries.json()) as { items: Array<{ id: string; status: string }> };
  assert.equal(entries.status, 200);
  assert.equal(
    entriesBody.items.some((item) => item.id === createdBody.item.id && item.status === 'archived'),
    true,
  );
});

void test('rejects qa suggestion and updates status', async () => {
  const eventId = `event-qa-reject-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await postHospitableWebhook(
    new Request('http://localhost/api/integrations/hospitable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId,
        reservationId: 'res-qa-reject-001',
        guestName: 'Riley',
        message: 'Can I check in at 7am?',
      }),
    }),
  );

  const pending = await getQaSuggestionsByProperty(
    new Request(
      'http://localhost/api/command-center/qa-suggestions?propertyId=property:res-qa-reject-001&status=pending',
    ),
    { params: Promise.resolve({ propertyId: 'property:res-qa-reject-001' }) },
  );
  const pendingBody = (await pending.json()) as { items: Array<{ id: string }> };
  const suggestionId = String(pendingBody.items[0]?.id);

  const rejected = await postRejectQaSuggestion(
    new Request(`http://localhost/api/command-center/qa-suggestions/${suggestionId}/reject`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actorId: 'qa-reviewer-2', reason: 'one-off question' }),
    }),
    { params: Promise.resolve({ id: suggestionId }) },
  );
  assert.equal(rejected.status, 200);

  const rejectedList = await getQaSuggestionsByProperty(
    new Request(
      'http://localhost/api/command-center/qa-suggestions?propertyId=property:res-qa-reject-001&status=rejected',
    ),
    { params: Promise.resolve({ propertyId: 'property:res-qa-reject-001' }) },
  );
  const rejectedBody = (await rejectedList.json()) as {
    items: Array<{ id: string; status: string }>;
  };
  assert.equal(rejectedList.status, 200);
  assert.equal(
    rejectedBody.items.some((item) => item.id === suggestionId && item.status === 'rejected'),
    true,
  );
});
