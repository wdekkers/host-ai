import assert from 'node:assert/strict';
import test from 'node:test';

import type { SmsGuardResult } from './sms-guard.js';
import { canSendToVendor } from './sms-guard.js';

/**
 * Minimal mock DB for canSendToVendor.
 * - Vendor query: .select().from().where().limit()
 * - Consent query: .select().from().where().orderBy().limit()
 * The two paths are distinguishable because consent goes through orderBy first.
 */
function makeMockDb(
  vendorRow: { id: string; status: string } | null,
  consentRow: { consentStatus: string } | null,
) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          // vendor query resolves here
          limit: () => Promise.resolve(vendorRow ? [vendorRow] : []),
          // consent query has an extra orderBy before limit
          orderBy: () => ({
            limit: () => Promise.resolve(consentRow ? [consentRow] : []),
          }),
        }),
      }),
    }),
  } as never;
}

void test('canSendToVendor: blocks when vendor not found', async () => {
  const db = makeMockDb(null, null);
  const result: SmsGuardResult = await canSendToVendor(db, 'unknown-id');
  assert.equal(result.allowed, false);
  assert.equal(!result.allowed && result.reason, 'vendor_not_found');
});

void test('canSendToVendor: blocks when vendor opted_out', async () => {
  const db = makeMockDb({ id: 'v1', status: 'opted_out' }, { consentStatus: 'opted_in' });
  const result: SmsGuardResult = await canSendToVendor(db, 'v1');
  assert.equal(result.allowed, false);
  assert.equal(!result.allowed && result.reason, 'vendor_opted_out');
});

void test('canSendToVendor: blocks when no consent record', async () => {
  const db = makeMockDb({ id: 'v1', status: 'active' }, null);
  const result: SmsGuardResult = await canSendToVendor(db, 'v1');
  assert.equal(result.allowed, false);
  assert.equal(!result.allowed && result.reason, 'no_consent');
});

void test('canSendToVendor: allows when active and opted_in', async () => {
  const db = makeMockDb({ id: 'v1', status: 'active' }, { consentStatus: 'opted_in' });
  const result: SmsGuardResult = await canSendToVendor(db, 'v1');
  assert.equal(result.allowed, true);
});
