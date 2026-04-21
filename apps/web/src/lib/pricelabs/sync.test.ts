import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runPriceLabsSyncForOrg } from './sync';
import { PriceLabsError } from '@walt/pricelabs';

const notImplementedClient = {
  listListings: async () => { throw new Error('not implemented'); },
  getRecommendedRates: async () => { throw new Error('not implemented'); },
  getSettings: async () => { throw new Error('not implemented'); },
};

void describe('runPriceLabsSyncForOrg', () => {
  const orgId = 'org-1';

  void it('returns no-op result when org has no credentials', async () => {
    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => new Date('2026-04-21T03:00:00Z'),
      getCredentials: async () => null,
      createSyncRun: async () => { throw new Error('should not be called'); },
      createClient: () => notImplementedClient,
      getActiveMappings: async () => [],
      getReservations: async () => [],
      insertSnapshots: async () => {},
      insertSettingsSnapshot: async () => {},
      updateSyncRun: async () => {},
      updateMappingLastSyncedAt: async () => {},
      markCredentialsInvalid: async () => {},
    });
    assert.deepEqual(result, { status: 'skipped_no_credentials' });
  });

  void it('marks credentials invalid on auth_rejected and fails run', async () => {
    const markInvalidCalls: string[] = [];
    const updateRunCalls: { runId: string; patch: { status: string } }[] = [];
    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => new Date('2026-04-21T03:00:00Z'),
      getCredentials: async () => ({ encryptedApiKey: 'ENC' }),
      decryptKey: () => 'key',
      createClient: () => ({
        listListings: async () => { throw new PriceLabsError('auth_rejected', 'rejected'); },
        getRecommendedRates: async () => { throw new Error('unreachable'); },
        getSettings: async () => { throw new Error('unreachable'); },
      }),
      createSyncRun: async () => 'run-1',
      getActiveMappings: async () => [],
      getReservations: async () => [],
      insertSnapshots: async () => {},
      insertSettingsSnapshot: async () => {},
      updateSyncRun: async (runId, patch) => { updateRunCalls.push({ runId, patch: patch as { status: string } }); },
      updateMappingLastSyncedAt: async () => {},
      markCredentialsInvalid: async (id) => { markInvalidCalls.push(id); },
    });
    assert.equal(result.status, 'failed');
    assert.deepEqual(markInvalidCalls, [orgId]);
    assert.equal(updateRunCalls.length, 1);
    const first = updateRunCalls[0];
    assert.ok(first);
    assert.equal(first.patch.status, 'failed');
  });

  void it('writes snapshots per listing with isBooked from reservations', async () => {
    const inserts: { date: string; isBooked: boolean }[][] = [];
    const settingsInserts: unknown[] = [];
    const updateRunCalls: { patch: { status: string; listingsSynced: number } }[] = [];
    const updateMappingCalls: { listingId: string; at: Date }[] = [];

    const today = new Date('2026-04-21T03:00:00Z');
    const rates = [
      { date: '2026-04-21', recommendedPrice: 500, publishedPrice: 550, basePrice: 450, minPrice: 300, maxPrice: 900, minStay: 2, closedToArrival: false, closedToDeparture: false },
      { date: '2026-04-22', recommendedPrice: 500, publishedPrice: 550, basePrice: 450, minPrice: 300, maxPrice: 900, minStay: 2, closedToArrival: false, closedToDeparture: false },
      { date: '2026-04-23', recommendedPrice: 500, publishedPrice: 550, basePrice: 450, minPrice: 300, maxPrice: 900, minStay: 2, closedToArrival: false, closedToDeparture: false },
    ];

    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => today,
      getCredentials: async () => ({ encryptedApiKey: 'ENC' }),
      decryptKey: () => 'key',
      createClient: () => ({
        listListings: async () => [{ id: 'pl-1', name: 'Demo', active: true }],
        getRecommendedRates: async () => rates,
        getSettings: async () => ({ listingId: 'pl-1', basePrice: 450, minPrice: 300, maxPrice: 900 }),
      }),
      createSyncRun: async () => 'run-1',
      getActiveMappings: async () => [{ pricelabsListingId: 'pl-1', propertyId: 'prop-1' }],
      getReservations: async () => [
        { propertyId: 'prop-1', arrivalDate: new Date('2026-04-22'), departureDate: new Date('2026-04-23') },
      ],
      insertSnapshots: async (rows) => { inserts.push(rows as { date: string; isBooked: boolean }[]); },
      insertSettingsSnapshot: async (r) => { settingsInserts.push(r); },
      updateSyncRun: async (_runId, patch) => { updateRunCalls.push({ patch: patch as { status: string; listingsSynced: number } }); },
      updateMappingLastSyncedAt: async (listingId, at) => { updateMappingCalls.push({ listingId, at }); },
      markCredentialsInvalid: async () => {},
    });

    assert.equal(result.status, 'success');
    assert.equal(inserts.length, 1);
    const inserted = inserts[0]!;
    assert.equal(inserted.length, 3);
    const booked = inserted.filter((r) => r.isBooked);
    assert.equal(booked.length, 1);
    assert.equal(booked[0]!.date, '2026-04-22');
    assert.equal(settingsInserts.length, 1);
    assert.deepEqual(updateMappingCalls, [{ listingId: 'pl-1', at: today }]);
    assert.equal(updateRunCalls.length, 1);
    assert.equal(updateRunCalls[0]!.patch.status, 'success');
    assert.equal(updateRunCalls[0]!.patch.listingsSynced, 1);
  });

  void it('all listings failing yields failed status with listingsFailed count', async () => {
    const updateRunCalls: { patch: { status: string; listingsFailed: number } }[] = [];
    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => new Date('2026-04-21T03:00:00Z'),
      getCredentials: async () => ({ encryptedApiKey: 'ENC' }),
      decryptKey: () => 'key',
      createClient: () => ({
        listListings: async () => [],
        getRecommendedRates: async () => { throw new Error('boom'); },
        getSettings: async () => ({ listingId: 'pl-1', basePrice: 450, minPrice: 300, maxPrice: 900 }),
      }),
      createSyncRun: async () => 'run-1',
      getActiveMappings: async () => [
        { pricelabsListingId: 'pl-1', propertyId: 'prop-1' },
        { pricelabsListingId: 'pl-2', propertyId: 'prop-2' },
      ],
      getReservations: async () => [],
      insertSnapshots: async () => {},
      insertSettingsSnapshot: async () => {},
      updateSyncRun: async (_runId, patch) => { updateRunCalls.push({ patch: patch as { status: string; listingsFailed: number } }); },
      updateMappingLastSyncedAt: async () => {},
      markCredentialsInvalid: async () => {},
    });
    assert.equal(result.status, 'failed');
    assert.equal(updateRunCalls.length, 1);
    assert.equal(updateRunCalls[0]!.patch.listingsFailed, 2);
  });
});
