import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeReservation, normalizeMessage } from './hospitable-normalize.js';

void test('normalizeReservation extracts core fields from Hospitable v2 payload', () => {
  const raw = {
    id: 'abc-123',
    conversation_id: 'conv-1',
    platform: 'airbnb',
    platform_id: 'BK001',
    status: 'booking',
    arrival_date: '2025-06-01T00:00:00Z',
    departure_date: '2025-06-05T00:00:00Z',
    check_in: '2025-06-01T15:00:00Z',
    check_out: '2025-06-05T11:00:00Z',
    booking_date: '2025-05-01T00:00:00Z',
    last_message_at: '2025-05-15T00:00:00Z',
    nights: 4,
    guest: { id: 'g1', first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
    properties: [{ id: 'prop-1', name: 'Beach House' }]
  };

  const result = normalizeReservation(raw);
  assert.equal(result.id, 'abc-123');
  assert.equal(result.platform, 'airbnb');
  assert.equal(result.guestFirstName, 'Jane');
  assert.equal(result.guestLastName, 'Doe');
  assert.equal(result.propertyId, 'prop-1');
  assert.equal(result.propertyName, 'Beach House');
  assert.equal(result.nights, 4);
});

void test('normalizeReservation handles missing guest and properties gracefully', () => {
  const raw = { id: 'xyz', status: 'cancelled' };
  const result = normalizeReservation(raw);
  assert.equal(result.id, 'xyz');
  assert.equal(result.guestFirstName, null);
  assert.equal(result.propertyId, null);
});

void test('normalizeMessage extracts core fields from Hospitable v2 message payload', () => {
  const raw = {
    reservation_id: 'res-1',
    platform: 'airbnb',
    body: 'What time is check-in?',
    sender_type: 'guest',
    sender: { full_name: 'Jane Doe' },
    created_at: '2025-05-10T10:00:00Z'
  };

  const result = normalizeMessage(raw, 'res-1');
  assert.notEqual(result, null);
  assert.equal(result!.reservationId, 'res-1');
  assert.equal(result!.body, 'What time is check-in?');
  assert.equal(result!.senderType, 'guest');
  assert.equal(result!.senderFullName, 'Jane Doe');
});

void test('normalizeMessage returns null when body is empty', () => {
  const raw = { reservation_id: 'res-1', body: '', sender_type: 'guest', created_at: '2025-05-10T10:00:00Z' };
  const result = normalizeMessage(raw, 'res-1');
  assert.equal(result, null);
});
