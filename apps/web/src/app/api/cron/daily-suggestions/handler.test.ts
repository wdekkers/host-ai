import assert from 'node:assert/strict';
import test from 'node:test';
import { handleDailySuggestions } from './handler';

const makeRequest = () =>
  new Request('http://localhost/api/cron/daily-suggestions', {
    method: 'POST',
    headers: { authorization: `Bearer test-secret` },
  });

void test('inserts welcome message suggestion for arriving reservation', async () => {
  const inserted: unknown[] = [];

  const response = await handleDailySuggestions(makeRequest(), {
    cronSecret: 'test-secret',
    getOrganizations: async () => [{ organizationId: 'org-1' }],
    getPropertyIds: async () => ['prop-1'],
    getArrivingReservations: async () => [
      {
        id: 'res-1',
        propertyId: 'prop-1',
        guestFirstName: 'Alice',
        arrivalDate: new Date('2026-03-20T15:00:00Z'),
      },
    ],
    getPropertyPool: async () => false,
    getPropertyName: async () => 'Palmera',
    insertSuggestion: async (row) => { inserted.push(row); },
  });

  assert.equal(response.status, 200);
  assert.equal(inserted.length, 1);
  assert.ok((inserted[0] as { title: string }).title.includes('welcome message'));
});

void test('inserts pool heating suggestion when property has pool', async () => {
  const inserted: unknown[] = [];

  await handleDailySuggestions(makeRequest(), {
    cronSecret: 'test-secret',
    getOrganizations: async () => [{ organizationId: 'org-1' }],
    getPropertyIds: async () => ['prop-1'],
    getArrivingReservations: async () => [
      {
        id: 'res-1',
        propertyId: 'prop-1',
        guestFirstName: 'Alice',
        arrivalDate: new Date('2026-03-20T15:00:00Z'),
      },
    ],
    getPropertyPool: async () => true,
    getPropertyName: async () => 'Palmera',
    insertSuggestion: async (row) => { inserted.push(row); },
  });

  assert.equal(inserted.length, 2);
  assert.ok((inserted[1] as { title: string }).title.toLowerCase().includes('pool'));
});

void test('returns 401 with wrong secret', async () => {
  const response = await handleDailySuggestions(
    new Request('http://localhost/api/cron/daily-suggestions', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    }),
    { cronSecret: 'test-secret' },
  );
  assert.equal(response.status, 401);
});

void test('no pool suggestion when property has no pool', async () => {
  const inserted: unknown[] = [];

  await handleDailySuggestions(makeRequest(), {
    cronSecret: 'test-secret',
    getOrganizations: async () => [{ organizationId: 'org-1' }],
    getPropertyIds: async () => ['prop-1'],
    getArrivingReservations: async () => [
      {
        id: 'res-1',
        propertyId: 'prop-1',
        guestFirstName: 'Bob',
        arrivalDate: new Date('2026-03-20T15:00:00Z'),
      },
    ],
    getPropertyPool: async () => false,
    getPropertyName: async () => 'Casa Blanca',
    insertSuggestion: async (row) => { inserted.push(row); },
  });

  assert.equal(inserted.length, 1);
  assert.ok(!(inserted[0] as { title: string }).title.toLowerCase().includes('pool'));
});
