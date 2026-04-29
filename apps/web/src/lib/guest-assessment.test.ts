import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAssessmentPrompt,
  computeInputsHash,
  parseAssessmentResponse,
  type AssessmentPromptInputs,
} from './guest-assessment';

const baseInputs: AssessmentPromptInputs = {
  booking: {
    guestName: 'Michael Smith',
    guestCount: { total: 4, adults: 2, children: 2, infants: 0, pets: 1 },
    nights: 7,
    arrivalDayOfWeek: 'Friday',
    bookingLeadDays: 3,
  },
  thread: [
    { sender: 'guest', body: 'We want to book April 24-May 1.' },
    { sender: 'host', body: 'Please confirm you accept the house rules.' },
    { sender: 'guest', body: 'Yes, we agree to all the house rules.' },
  ],
  propertyHouseRules: 'No pets. No parties. No unregistered visitors.',
  hostScoringRules: ['Exception-seeking on pet/visitor rules is a red flag.'],
  effectiveCatalog: [
    { id: 'sig-a', label: 'Party / event / gathering', dimension: 'policy_violation', severity: 'high', valence: 'risk' },
    { id: 'sig-b', label: 'Strong reviews', dimension: 'profile', severity: 'low', valence: 'trust' },
  ],
  confirmedIncidents: [
    { type: 'extra_guests', severity: 'high', notes: 'Brought 2 extra guests', date: '2026-01-15' },
  ],
  pastReviews: [
    { rating: 5, publicReview: 'Great guests', privateFeedback: null },
  ],
};

void test('buildAssessmentPrompt includes every input section', () => {
  const prompt = buildAssessmentPrompt(baseInputs);
  assert.ok(prompt.includes('PROPERTY HOUSE RULES'));
  assert.ok(prompt.includes('No pets'));
  assert.ok(prompt.includes('HOST RULES'));
  assert.ok(prompt.includes('SIGNAL CATALOG'));
  assert.ok(prompt.includes('sig-a'));
  assert.ok(prompt.includes('Party / event / gathering'));
  assert.ok(prompt.includes('PRIOR INCIDENTS'));
  assert.ok(prompt.includes('Brought 2 extra guests'));
  assert.ok(prompt.includes('PAST REVIEWS'));
  assert.ok(prompt.includes('BOOKING'));
  assert.ok(prompt.includes('CONVERSATION'));
});

void test('buildAssessmentPrompt omits optional sections when empty', () => {
  const prompt = buildAssessmentPrompt({
    ...baseInputs,
    propertyHouseRules: null,
    hostScoringRules: [],
    confirmedIncidents: [],
    pastReviews: [],
  });
  assert.ok(!prompt.includes('PROPERTY HOUSE RULES'));
  assert.ok(!prompt.includes('HOST RULES'));
  assert.ok(!prompt.includes('PRIOR INCIDENTS'));
  assert.ok(!prompt.includes('PAST REVIEWS'));
});

void test('buildAssessmentPrompt instructs that public reviews do not override private feedback or incidents', () => {
  const prompt = buildAssessmentPrompt(baseInputs);
  assert.ok(prompt.toLowerCase().includes('does not override'));
});

void test('buildAssessmentPrompt always emits the JSON output schema', () => {
  const prompt = buildAssessmentPrompt(baseInputs);
  assert.ok(prompt.includes('"score"'));
  assert.ok(prompt.includes('"risk_level"'));
  assert.ok(prompt.includes('"trust_level"'));
  assert.ok(prompt.includes('"recommendation"'));
  assert.ok(prompt.includes('"signals"'));
  assert.ok(prompt.includes('"rules_acceptance"'));
});

void test('computeInputsHash returns the same hash for the same inputs', () => {
  assert.equal(computeInputsHash(baseInputs), computeInputsHash(baseInputs));
});

void test('computeInputsHash returns a different hash when a message body changes', () => {
  const modified: AssessmentPromptInputs = {
    ...baseInputs,
    thread: [...baseInputs.thread, { sender: 'guest', body: 'One more question.' }],
  };
  assert.notEqual(computeInputsHash(baseInputs), computeInputsHash(modified));
});

void test('computeInputsHash returns a different hash when the catalog changes', () => {
  const modified: AssessmentPromptInputs = {
    ...baseInputs,
    effectiveCatalog: [
      ...baseInputs.effectiveCatalog,
      { id: 'sig-c', label: 'New signal', dimension: 'profile', severity: 'medium', valence: 'risk' },
    ],
  };
  assert.notEqual(computeInputsHash(baseInputs), computeInputsHash(modified));
});

void test('parseAssessmentResponse parses a valid response and clamps score to 1-10', () => {
  const content = JSON.stringify({
    score: 12,
    summary: 'Some summary',
    risk_level: 'medium',
    trust_level: 'low',
    recommendation: 'Approve with caution',
    signals: [{ catalog_item_id: 'sig-a', explanation: 'Why' }],
    rules_acceptance: {
      requested: true,
      confirmed: true,
      confirmed_at: '2026-04-24T00:00:00Z',
      confirmation_quote: 'Yes, we agree',
    },
  });
  const result = parseAssessmentResponse(content);
  assert.ok(result);
  assert.equal(result!.score, 10);
  assert.equal(result!.riskLevel, 'medium');
  assert.equal(result!.signals[0]!.catalogItemId, 'sig-a');
  assert.equal(result!.rulesAcceptance.confirmed, true);
});

void test('parseAssessmentResponse returns null on invalid JSON', () => {
  assert.equal(parseAssessmentResponse('not json'), null);
});

void test('parseAssessmentResponse returns null when required fields are missing', () => {
  assert.equal(parseAssessmentResponse(JSON.stringify({ score: 7 })), null);
});
