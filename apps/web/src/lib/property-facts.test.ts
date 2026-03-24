import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPropertyFacts } from './property-facts';

void test('formatPropertyFacts builds prompt section from full property row', () => {
  const result = formatPropertyFacts({
    checkInTime: '4:00 PM',
    checkOutTime: '11:00 AM',
    timezone: 'America/Chicago',
    maxGuests: 12,
    bedrooms: 4,
    beds: 6,
    bathrooms: '3.5',
    petsAllowed: false,
    smokingAllowed: false,
    eventsAllowed: true,
    amenities: ['wifi', 'pool', 'parking'],
    propertyType: 'house',
    hasPool: true,
    description: 'A beautiful beachfront property with ocean views.',
  });

  assert.ok(result.includes('Check-in: 4:00 PM'));
  assert.ok(result.includes('Check-out: 11:00 AM'));
  assert.ok(result.includes('Max guests: 12'));
  assert.ok(result.includes('Bedrooms: 4'));
  assert.ok(result.includes('Bathrooms: 3.5'));
  assert.ok(result.includes('Pets allowed: No'));
  assert.ok(result.includes('Events allowed: Yes'));
  assert.ok(result.includes('wifi, pool, parking'));
  assert.ok(result.includes('Property type: house'));
  assert.ok(result.includes('Pool: Yes'));
  assert.ok(result.includes('beachfront property'));
});

void test('formatPropertyFacts omits null fields', () => {
  const result = formatPropertyFacts({
    checkInTime: '3:00 PM',
    checkOutTime: null,
    timezone: null,
    maxGuests: null,
    bedrooms: null,
    beds: null,
    bathrooms: null,
    petsAllowed: null,
    smokingAllowed: null,
    eventsAllowed: null,
    amenities: null,
    propertyType: null,
    hasPool: false,
    description: null,
  });

  assert.ok(result.includes('Check-in: 3:00 PM'));
  assert.ok(!result.includes('Check-out'));
  assert.ok(!result.includes('Max guests'));
  assert.ok(!result.includes('Bedrooms'));
  assert.ok(!result.includes('Pets'));
});

void test('formatPropertyFacts returns empty string when no fields present', () => {
  const result = formatPropertyFacts({
    checkInTime: null,
    checkOutTime: null,
    timezone: null,
    maxGuests: null,
    bedrooms: null,
    beds: null,
    bathrooms: null,
    petsAllowed: null,
    smokingAllowed: null,
    eventsAllowed: null,
    amenities: null,
    propertyType: null,
    hasPool: false,
    description: null,
  });

  assert.equal(result, '');
});
