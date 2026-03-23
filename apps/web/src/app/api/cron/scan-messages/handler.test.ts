import assert from 'node:assert/strict';
import test from 'node:test';
import { handleScanMessages } from './handler.js';

void test('scans unscanned messages and marks them scanned', async () => {
  let scannedId: string | undefined;
  let inserted = false;

  await handleScanMessages(
    new Request('http://localhost/api/cron/scan-messages', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    }),
    {
      cronSecret: 'test-secret',
      getUnscannedMessages: async () => [
        { id: 'msg-1', reservationId: 'res-1', body: 'We love the pool!', senderType: 'guest' },
      ],
      markScanned: async (id) => { scannedId = id; },
      getReservationContext: async () => ({
        reservationId: 'res-1',
        propertyId: 'prop-1',
        propertyName: 'Palmera',
        guestFirstName: 'Alice',
        arrivalDate: '2026-03-20',
        organizationId: 'org-1',
      }),
      analyze: async () => ({ intent: 'pool_heating', escalationLevel: 'none' as const, escalationReason: null, suggestedTask: { title: 'Start pool heating before Alice arrival', description: 'Guest mentioned pool.' }, needsReply: true }),
      generateSuggestion: async () => null,
      insertSuggestion: async () => { inserted = true; },
      insertDraftEvent: async () => {},
      updateMessageDraft: async () => {},
    },
  );

  assert.equal(scannedId, 'msg-1');
  assert.ok(inserted);
});

void test('marks scanned even if no suggestion is generated', async () => {
  let scannedId: string | undefined;
  let inserted = false;

  await handleScanMessages(
    new Request('http://localhost/api/cron/scan-messages', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    }),
    {
      cronSecret: 'test-secret',
      getUnscannedMessages: async () => [
        { id: 'msg-2', reservationId: 'res-2', body: 'Thank you!', senderType: 'guest' },
      ],
      markScanned: async (id) => { scannedId = id; },
      getReservationContext: async () => ({
        reservationId: 'res-2',
        propertyId: 'prop-1',
        propertyName: 'Palmera',
        guestFirstName: 'Bob',
        arrivalDate: '2026-03-21',
        organizationId: 'org-1',
      }),
      analyze: async () => ({ intent: 'compliment', escalationLevel: 'none' as const, escalationReason: null, suggestedTask: null, needsReply: false }),
      generateSuggestion: async () => null,
      insertSuggestion: async () => { inserted = true; },
      insertDraftEvent: async () => {},
      updateMessageDraft: async () => {},
    },
  );

  assert.equal(scannedId, 'msg-2');
  assert.equal(inserted, false);
});

void test('returns 401 with wrong secret', async () => {
  const response = await handleScanMessages(
    new Request('http://localhost/api/cron/scan-messages', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    }),
    { cronSecret: 'test-secret' },
  );
  assert.equal(response.status, 401);
});

void test('generates AI draft and inserts draft event', async () => {
  let draftEventInserted = false;
  let messageDraftUpdated = false;

  await handleScanMessages(
    new Request('http://localhost/api/cron/scan-messages', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    }),
    {
      cronSecret: 'test-secret',
      getUnscannedMessages: async () => [
        { id: 'msg-1', reservationId: 'res-1', body: 'Can we check in early?', senderType: 'guest' },
      ],
      markScanned: async () => {},
      getReservationContext: async () => ({
        reservationId: 'res-1', propertyId: 'prop-1', propertyName: 'Palmera',
        guestFirstName: 'Alice', arrivalDate: '2026-03-25', organizationId: 'org-1',
      }),
      analyze: async () => ({
        intent: 'early_check_in', escalationLevel: 'none' as const,
        escalationReason: null, suggestedTask: { title: 'Early check-in for Alice', description: 'Wants 2pm' }, needsReply: true,
      }),
      generateSuggestion: async () => ({
        suggestion: 'Let me check with our cleaners!',
        sourcesUsed: [{ type: 'knowledge_entry' as const, id: 'ke-1', label: 'Check-in policy' }],
      }),
      insertSuggestion: async () => {},
      insertDraftEvent: async () => { draftEventInserted = true; },
      updateMessageDraft: async () => { messageDraftUpdated = true; },
    },
  );

  assert.ok(draftEventInserted);
  assert.ok(messageDraftUpdated);
});
