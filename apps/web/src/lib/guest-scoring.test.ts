import assert from 'node:assert/strict';
import test from 'node:test';

import { buildScoringPrompt } from './guest-scoring';

const base = {
  booking: {
    guestName: 'Michael Smith',
    guestCount: { total: 4, adults: 2, children: 2, infants: 0, pets: 1 },
    nights: 7,
    arrivalDayOfWeek: 'Friday',
    bookingLeadDays: 3,
  },
  thread: [
    { sender: 'guest' as const, body: 'We want to book April 24-May 1.' },
    { sender: 'host' as const, body: 'Please confirm you accept house rules.' },
    { sender: 'guest' as const, body: 'Would you consider a pet deposit?' },
  ],
  propertyHouseRules: 'No pets. No parties. No unregistered visitors.' as string | null,
  scoringRules: ['Exception-seeking on pet/visitor rules is a red flag.'],
  internalHistory: null as string | null,
  pastReviews: [] as Array<{
    rating: number | null;
    publicReview: string | null;
    privateFeedback: string | null;
  }>,
};

test('buildScoringPrompt includes every non-empty section', () => {
  const prompt = buildScoringPrompt(base);
  assert.ok(prompt.includes('PROPERTY HOUSE RULES'));
  assert.ok(prompt.includes('No pets. No parties.'));
  assert.ok(prompt.includes('HOST RULES'));
  assert.ok(prompt.includes('Exception-seeking'));
  assert.ok(prompt.includes('CONVERSATION SO FAR'));
  assert.ok(prompt.includes('pet deposit'));
  assert.ok(prompt.includes('BOOKING'));
});

test('buildScoringPrompt omits HOST RULES block when list is empty', () => {
  const prompt = buildScoringPrompt({ ...base, scoringRules: [] });
  assert.ok(!prompt.includes('HOST RULES'));
});

test('buildScoringPrompt omits PROPERTY HOUSE RULES when null', () => {
  const prompt = buildScoringPrompt({ ...base, propertyHouseRules: null });
  assert.ok(!prompt.includes('PROPERTY HOUSE RULES'));
});

test('buildScoringPrompt omits GUEST HISTORY when no internal history and no reviews', () => {
  const prompt = buildScoringPrompt({ ...base, internalHistory: null, pastReviews: [] });
  assert.ok(!prompt.includes('GUEST HISTORY'));
});

test('buildScoringPrompt keeps most recent 20 messages regardless of budget', () => {
  const thread = Array.from({ length: 30 }, (_, i) => ({
    sender: (i % 2 === 0 ? 'guest' : 'host') as 'guest' | 'host',
    body: `msg-${i}`,
  }));
  const prompt = buildScoringPrompt({ ...base, thread });
  for (let i = 10; i < 30; i += 1) {
    assert.ok(prompt.includes(`msg-${i}`), `expected msg-${i} in prompt`);
  }
});
