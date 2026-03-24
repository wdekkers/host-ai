import test from 'node:test';
import assert from 'node:assert/strict';
import {
  journeyStepSchema,
  triggerConfigSchema,
  coverageScheduleSchema,
  journeyDefinitionSchema,
  generateJourneyInputSchema,
  editJourneyInputSchema,
} from './journeys.js';

// ── journeyStepSchema ──

void test('journeyStepSchema accepts valid send_message step', () => {
  const result = journeyStepSchema.safeParse({
    type: 'send_message',
    directive: 'Welcome to your stay! Let us know if you need anything.',
  });
  assert.equal(result.success, true);
});

void test('journeyStepSchema accepts valid wait step with delay', () => {
  const result = journeyStepSchema.safeParse({
    type: 'wait',
    directive: { delay: 3600 },
  });
  assert.equal(result.success, true);
});

void test('journeyStepSchema accepts valid wait step with until', () => {
  const result = journeyStepSchema.safeParse({
    type: 'wait',
    directive: { until: 'check_in' },
  });
  assert.equal(result.success, true);
});

void test('journeyStepSchema accepts valid ai_decision with skipToStep', () => {
  const result = journeyStepSchema.safeParse({
    type: 'ai_decision',
    directive: 'Decide if guest needs assistance',
    skipToStep: 3,
  });
  assert.equal(result.success, true);
});

void test('journeyStepSchema rejects unknown step type', () => {
  const result = journeyStepSchema.safeParse({
    type: 'unknown_type',
    directive: 'some directive',
  });
  assert.equal(result.success, false);
});

// ── triggerConfigSchema ──

void test('triggerConfigSchema accepts check_in_approaching config', () => {
  const result = triggerConfigSchema.safeParse({
    triggerType: 'check_in_approaching',
    config: { hoursBeforeCheckIn: 24 },
  });
  assert.equal(result.success, true);
});

void test('triggerConfigSchema accepts gap_detected config', () => {
  const result = triggerConfigSchema.safeParse({
    triggerType: 'gap_detected',
    config: { minGapNights: 2, maxGapNights: 7 },
  });
  assert.equal(result.success, true);
});

// ── coverageScheduleSchema ──

void test('coverageScheduleSchema accepts valid schedule', () => {
  const result = coverageScheduleSchema.safeParse({
    timezone: 'Europe/Amsterdam',
    windows: [
      { days: ['mon', 'tue', 'wed', 'thu', 'fri'], startHour: 9, endHour: 17 },
    ],
  });
  assert.equal(result.success, true);
});

void test('coverageScheduleSchema rejects invalid day', () => {
  const result = coverageScheduleSchema.safeParse({
    timezone: 'Europe/Amsterdam',
    windows: [
      { days: ['monday'], startHour: 9, endHour: 17 },
    ],
  });
  assert.equal(result.success, false);
});

// ── journeyDefinitionSchema ──

void test('journeyDefinitionSchema validates a complete journey', () => {
  const result = journeyDefinitionSchema.safeParse({
    name: 'Post-Booking Welcome',
    description: 'Send a welcome message after booking is confirmed',
    triggerType: 'booking_confirmed',
    triggerConfig: { hoursBeforeCheckIn: 0 },
    steps: [
      {
        type: 'send_message',
        directive: 'Hi {{guest_name}}, thanks for booking!',
      },
      {
        type: 'wait',
        directive: { delay: 86400 },
      },
      {
        type: 'send_message',
        directive: 'Reminder: your check-in is tomorrow.',
      },
    ],
    coverageSchedule: {
      timezone: 'America/New_York',
      windows: [
        { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], startHour: 8, endHour: 22 },
      ],
    },
    approvalMode: 'draft',
  });
  assert.equal(result.success, true);
});

// ── generateJourneyInputSchema ──

void test('generateJourneyInputSchema accepts valid input with prompt and propertyIds', () => {
  const result = generateJourneyInputSchema.safeParse({
    prompt: 'Create a welcome journey for new guests',
    propertyIds: ['prop-1', 'prop-2'],
  });
  assert.equal(result.success, true);
});

void test('generateJourneyInputSchema rejects prompt shorter than 10 chars', () => {
  const result = generateJourneyInputSchema.safeParse({
    prompt: 'Too short',
  });
  assert.equal(result.success, false);
});

// ── editJourneyInputSchema ──

void test('editJourneyInputSchema accepts valid journeyId (uuid) and instruction', () => {
  const result = editJourneyInputSchema.safeParse({
    journeyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    instruction: 'Add a follow-up message after check-out',
  });
  assert.equal(result.success, true);
});

void test('editJourneyInputSchema rejects non-uuid journeyId', () => {
  const result = editJourneyInputSchema.safeParse({
    journeyId: 'not-a-uuid',
    instruction: 'Add a follow-up message after check-out',
  });
  assert.equal(result.success, false);
});
