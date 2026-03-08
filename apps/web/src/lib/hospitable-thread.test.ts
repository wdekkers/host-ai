import assert from 'node:assert/strict';
import test from 'node:test';

import { buildHospitableMessagesPath, mergeOlderMessages } from './hospitable-thread';

void test('buildHospitableMessagesPath uses latest-5 default and optional beforeCursor', () => {
  const initial = buildHospitableMessagesPath({ reservationId: 'res-001' });
  assert.equal(initial, '/api/integrations/hospitable/messages?reservationId=res-001&limit=5');

  const older = buildHospitableMessagesPath({
    reservationId: 'res-001',
    beforeCursor: 'abc123',
  });
  assert.equal(
    older,
    '/api/integrations/hospitable/messages?reservationId=res-001&limit=5&beforeCursor=abc123',
  );
});

void test('mergeOlderMessages prepends older chunk and removes duplicate ids', () => {
  const current = [
    {
      id: 'm4',
      reservationId: 'res-001',
      guestName: 'A',
      message: '4',
      sentAt: '2026-03-01T10:04:00.000Z',
    },
    {
      id: 'm5',
      reservationId: 'res-001',
      guestName: 'A',
      message: '5',
      sentAt: '2026-03-01T10:05:00.000Z',
    },
  ];
  const older = [
    {
      id: 'm2',
      reservationId: 'res-001',
      guestName: 'A',
      message: '2',
      sentAt: '2026-03-01T10:02:00.000Z',
    },
    {
      id: 'm3',
      reservationId: 'res-001',
      guestName: 'A',
      message: '3',
      sentAt: '2026-03-01T10:03:00.000Z',
    },
    {
      id: 'm4',
      reservationId: 'res-001',
      guestName: 'A',
      message: '4 duplicate',
      sentAt: '2026-03-01T10:04:00.000Z',
    },
  ];

  const merged = mergeOlderMessages(current, older);
  assert.deepEqual(
    merged.map((item) => item.id),
    ['m2', 'm3', 'm4', 'm5'],
  );
});
