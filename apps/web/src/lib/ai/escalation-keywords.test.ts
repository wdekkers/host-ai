import assert from 'node:assert/strict';
import test from 'node:test';
import { detectEscalationKeywords } from './escalation-keywords.js';

void test('detects escalate-level keywords', () => {
  assert.equal(detectEscalationKeywords('I want a refund immediately'), 'escalate');
  assert.equal(detectEscalationKeywords('My lawyer will be in touch'), 'escalate');
  assert.equal(detectEscalationKeywords('Someone was injured at the pool'), 'escalate');
});

void test('detects caution-level keywords', () => {
  assert.equal(detectEscalationKeywords('The AC is broken and not working'), 'caution');
  assert.equal(detectEscalationKeywords('I will leave a bad review'), 'caution');
  assert.equal(detectEscalationKeywords('I want compensation for this'), 'caution');
});

void test('returns none for normal messages', () => {
  assert.equal(detectEscalationKeywords('What time is check-in?'), 'none');
  assert.equal(detectEscalationKeywords('Can we heat the pool?'), 'none');
  assert.equal(detectEscalationKeywords('Thanks for a great stay!'), 'none');
});

void test('is case-insensitive', () => {
  assert.equal(detectEscalationKeywords('I WANT A REFUND'), 'escalate');
  assert.equal(detectEscalationKeywords('This is UNACCEPTABLE'), 'caution');
});

void test('escalate takes priority over caution', () => {
  assert.equal(detectEscalationKeywords('This broken thing caused an injury, I want a refund'), 'escalate');
});
