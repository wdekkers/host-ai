import assert from 'node:assert/strict';
import test from 'node:test';

import { isValidE164, toE164 } from './phone.js';

void test('toE164: formats US 10-digit number', () => {
  assert.equal(toE164('5551234567'), '+15551234567');
});

void test('toE164: strips dashes and parens', () => {
  assert.equal(toE164('(555) 123-4567'), '+15551234567');
});

void test('toE164: already E.164 passthrough', () => {
  assert.equal(toE164('+15551234567'), '+15551234567');
});

void test('toE164: returns null for invalid input', () => {
  assert.equal(toE164('notaphone'), null);
});

void test('isValidE164: valid number', () => {
  assert.equal(isValidE164('+15551234567'), true);
});

void test('isValidE164: invalid number', () => {
  assert.equal(isValidE164('5551234567'), false);
});
