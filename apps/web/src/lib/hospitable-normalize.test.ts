import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeReservation, normalizeMessage, normalizeProperty } from './hospitable-normalize';

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
    properties: [{ id: 'prop-1', name: 'Beach House' }],
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
    created_at: '2025-05-10T10:00:00Z',
  };

  const result = normalizeMessage(raw, 'res-1');
  assert.notEqual(result, null);
  assert.equal(result!.reservationId, 'res-1');
  assert.equal(result!.body, 'What time is check-in?');
  assert.equal(result!.senderType, 'guest');
  assert.equal(result!.senderFullName, 'Jane Doe');
});

void test('normalizeMessage returns null when body is empty', () => {
  const raw = {
    reservation_id: 'res-1',
    body: '',
    sender_type: 'guest',
    created_at: '2025-05-10T10:00:00Z',
  };
  const result = normalizeMessage(raw, 'res-1');
  assert.equal(result, null);
});

void test('normalizeReservation reads status from reservation_status.current.category', () => {
  const raw = {
    id: 'res-status-1',
    status: 'booking', // deprecated field
    reservation_status: {
      current: { category: 'accepted', sub_category: 'accepted' },
      history: [],
    },
  };
  const result = normalizeReservation(raw);
  assert.equal(result.status, 'accepted');
});

void test('normalizeReservation falls back to raw.status when reservation_status is absent', () => {
  const raw = { id: 'res-fallback', status: 'cancelled' };
  const result = normalizeReservation(raw);
  assert.equal(result.status, 'cancelled');
});

void test('normalizeProperty extracts all Hospitable fields', () => {
  const raw = {
    id: 'prop-1',
    name: 'Beach House',
    public_name: 'Sunny Beach House',
    listed: true,
    check_in: '4:00 PM',
    check_out: '11:00 AM',
    timezone: 'America/Chicago',
    description: 'A beautiful beachfront property.',
    summary: 'Beachfront with pool.',
    property_type: 'house',
    room_type: 'entire_home',
    picture: 'https://example.com/pic.jpg',
    currency: 'USD',
    calendar_restricted: false,
    amenities: ['wifi', 'pool', 'parking', 'kitchen'],
    tags: ['luxury', 'beachfront'],
    capacity: { max: 12, bedrooms: 4, beds: 6, bathrooms: 3.5 },
    house_rules: { pets_allowed: false, smoking_allowed: false, events_allowed: true },
    address: {
      number: '123',
      street: '456 Ocean Dr',
      city: 'Frisco',
      state: 'TX',
      country: 'US',
      postcode: '75034',
      display: '456 Ocean Dr, Frisco, TX',
      coordinates: { latitude: 33.1507, longitude: -96.8236 },
    },
    listings: [
      { platform: 'airbnb', platform_id: 'AIR123', platform_name: 'Beach House on Airbnb' },
    ],
    room_details: [
      { type: 'king', quantity: 2 },
      { type: 'queen', quantity: 1 },
    ],
    parent_child: { type: 'parent', children: ['prop-2'] },
    ical_imports: [{ uuid: 'ical-1', url: 'https://example.com/cal.ics', name: 'VRBO' }],
  };

  const result = normalizeProperty(raw);

  // Existing fields
  assert.equal(result.id, 'prop-1');
  assert.equal(result.name, 'Beach House');
  assert.equal(result.address, '456 Ocean Dr');
  assert.equal(result.city, 'Frisco');
  assert.equal(result.status, 'active');

  // Tier 1
  assert.equal(result.checkInTime, '4:00 PM');
  assert.equal(result.checkOutTime, '11:00 AM');
  assert.equal(result.timezone, 'America/Chicago');
  assert.equal(result.maxGuests, 12);
  assert.equal(result.bedrooms, 4);
  assert.equal(result.beds, 6);
  assert.equal(result.bathrooms, '3.5');
  assert.equal(result.petsAllowed, false);
  assert.equal(result.smokingAllowed, false);
  assert.equal(result.eventsAllowed, true);
  assert.deepEqual(result.amenities, ['wifi', 'pool', 'parking', 'kitchen']);

  // Tier 2
  assert.equal(result.description, 'A beautiful beachfront property.');
  assert.equal(result.summary, 'Beachfront with pool.');
  assert.equal(result.propertyType, 'house');
  assert.equal(result.roomType, 'entire_home');
  assert.equal(result.pictureUrl, 'https://example.com/pic.jpg');
  assert.equal(result.currency, 'USD');
  assert.equal(result.addressState, 'TX');
  assert.equal(result.country, 'US');
  assert.equal(result.postcode, '75034');
  assert.equal(result.addressNumber, '123');
  assert.equal(result.latitude, 33.1507);
  assert.equal(result.longitude, -96.8236);
  assert.equal(result.publicName, 'Sunny Beach House');
  assert.equal(result.calendarRestricted, false);
  assert.deepEqual(result.listings, [
    { platform: 'airbnb', platform_id: 'AIR123', platform_name: 'Beach House on Airbnb' },
  ]);
  assert.deepEqual(result.roomDetails, [
    { type: 'king', quantity: 2 },
    { type: 'queen', quantity: 1 },
  ]);
  assert.deepEqual(result.tags, ['luxury', 'beachfront']);
  assert.deepEqual(result.parentChild, { type: 'parent', children: ['prop-2'] });
  assert.deepEqual(result.icalImports, [
    { uuid: 'ical-1', url: 'https://example.com/cal.ics', name: 'VRBO' },
  ]);
});

void test('normalizeProperty handles minimal payload gracefully', () => {
  const raw = { id: 'prop-min', name: 'Minimal', listed: false };
  const result = normalizeProperty(raw);
  assert.equal(result.id, 'prop-min');
  assert.equal(result.name, 'Minimal');
  assert.equal(result.status, 'inactive');
  assert.equal(result.checkInTime, null);
  assert.equal(result.maxGuests, null);
  assert.equal(result.petsAllowed, null);
  assert.equal(result.amenities, null);
  assert.equal(result.latitude, null);
  assert.equal(result.listings, null);
});
