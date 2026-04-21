import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runPriceLabsSyncForOrg } from './sync';
import {
  PriceLabsError,
  type Listing,
  type ListingPricesEntry,
  type PriceLabsClient,
} from '@walt/pricelabs';

function makeListing(id: string, overrides: Partial<Listing> = {}): Listing {
  return {
    id,
    pms: 'airbnb',
    name: `Listing ${id}`,
    push_enabled: true,
    isHidden: false,
    base: 450,
    min: 300,
    max: 900,
    ...overrides,
  };
}

void describe('runPriceLabsSyncForOrg', () => {
  const orgId = 'org-1';

  void it('returns no-op result when PriceLabs is not configured', async () => {
    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => new Date('2026-04-21T03:00:00Z'),
      getClient: () => null,
      createSyncRun: async () => {
        throw new Error('should not be called');
      },
      getActiveMappings: async () => [],
      insertSnapshots: async () => {},
      insertSettingsSnapshot: async () => {},
      updateSyncRun: async () => {},
      updateMappingLastSyncedAt: async () => {},
    });
    assert.deepEqual(result, { status: 'skipped_not_configured' });
  });

  void it('fails run and logs on auth_rejected from listListings', async () => {
    const updateRunCalls: { runId: string; patch: { status: string; errorSummary?: string } }[] = [];
    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => new Date('2026-04-21T03:00:00Z'),
      getClient: (): PriceLabsClient => ({
        listListings: async () => {
          throw new PriceLabsError('auth_rejected', 'rejected');
        },
        getListingPrices: async () => {
          throw new Error('unreachable');
        },
      }),
      createSyncRun: async () => 'run-1',
      getActiveMappings: async () => [],
      insertSnapshots: async () => {},
      insertSettingsSnapshot: async () => {},
      updateSyncRun: async (runId, patch) => {
        updateRunCalls.push({
          runId,
          patch: patch as { status: string; errorSummary?: string },
        });
      },
      updateMappingLastSyncedAt: async () => {},
    });
    assert.equal(result.status, 'failed');
    assert.equal(updateRunCalls.length, 1);
    const first = updateRunCalls[0]!;
    assert.equal(first.patch.status, 'failed');
    assert.equal(first.patch.errorSummary, 'auth_rejected');
  });

  void it('writes snapshots with isBooked from booking_status + dollars→cents conversion', async () => {
    const inserts: { date: string; isBooked: boolean; recommendedPrice: number; publishedPrice: number | null; basePrice: number }[][] = [];
    const settingsInserts: { settingsBlob: unknown }[] = [];
    const updateRunCalls: { patch: { status: string; listingsSynced: number } }[] = [];
    const updateMappingCalls: { listingId: string; at: Date }[] = [];

    const today = new Date('2026-04-21T03:00:00Z');
    const listing = makeListing('pl-1');
    const entries: ListingPricesEntry[] = [
      {
        id: 'pl-1',
        pms: 'airbnb',
        data: [
          { date: '2026-04-21', price: 250, user_price: 250, min_stay: 2, booking_status: '' },
          { date: '2026-04-22', price: 525, user_price: -1, min_stay: 2, booking_status: 'Booked (Check-In)' },
          { date: '2026-04-23', price: 525, user_price: -1, min_stay: 2, booking_status: 'Booked' },
        ],
      },
    ];

    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => today,
      getClient: (): PriceLabsClient => ({
        listListings: async () => [listing],
        getListingPrices: async () => entries,
      }),
      createSyncRun: async () => 'run-1',
      getActiveMappings: async () => [{ pricelabsListingId: 'pl-1', propertyId: 'prop-1' }],
      insertSnapshots: async (rows) => {
        inserts.push(
          rows as {
            date: string;
            isBooked: boolean;
            recommendedPrice: number;
            publishedPrice: number | null;
            basePrice: number;
          }[],
        );
      },
      insertSettingsSnapshot: async (r) => {
        settingsInserts.push(r);
      },
      updateSyncRun: async (_runId, patch) => {
        updateRunCalls.push({
          patch: patch as { status: string; listingsSynced: number },
        });
      },
      updateMappingLastSyncedAt: async (listingId, at) => {
        updateMappingCalls.push({ listingId, at });
      },
    });

    assert.equal(result.status, 'success');
    assert.equal(inserts.length, 1);
    const inserted = inserts[0]!;
    assert.equal(inserted.length, 3);

    const booked = inserted.filter((r) => r.isBooked);
    assert.equal(booked.length, 2);
    assert.equal(booked[0]!.date, '2026-04-22');

    // dollars → cents at the boundary
    assert.equal(inserted[0]!.recommendedPrice, 25000);
    assert.equal(inserted[0]!.publishedPrice, 25000);
    // user_price === -1 sentinel → publishedPrice is null
    assert.equal(inserted[1]!.publishedPrice, null);
    // base price pulled from the top-level listing (450 → 45000)
    assert.equal(inserted[0]!.basePrice, 45000);

    // settings snapshot stores the full listing object
    assert.equal(settingsInserts.length, 1);
    assert.deepEqual(settingsInserts[0]!.settingsBlob, listing);
    assert.deepEqual(updateMappingCalls, [{ listingId: 'pl-1', at: today }]);
    assert.equal(updateRunCalls[0]!.patch.status, 'success');
    assert.equal(updateRunCalls[0]!.patch.listingsSynced, 1);
  });

  void it('partial status when mix of success and error entries is returned', async () => {
    const inserts: unknown[][] = [];
    const updateRunCalls: {
      patch: { status: string; listingsSynced: number; listingsFailed: number; errorSummary?: string };
    }[] = [];
    const listings = [makeListing('pl-ok', { pms: 'airbnb' }), makeListing('pl-err', { pms: 'smartbnb' })];
    const entries: ListingPricesEntry[] = [
      {
        id: 'pl-ok',
        pms: 'airbnb',
        data: [{ date: '2026-04-21', price: 250, booking_status: '' }],
      },
      {
        id: 'pl-err',
        pms: 'smartbnb',
        error: 'Listing sync is not toggled ON in PriceLabs',
        error_status: 'LISTING_TOGGLE_OFF',
      },
    ];

    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => new Date('2026-04-21T03:00:00Z'),
      getClient: (): PriceLabsClient => ({
        listListings: async () => listings,
        getListingPrices: async () => entries,
      }),
      createSyncRun: async () => 'run-1',
      getActiveMappings: async () => [
        { pricelabsListingId: 'pl-ok', propertyId: 'prop-1' },
        { pricelabsListingId: 'pl-err', propertyId: 'prop-2' },
      ],
      insertSnapshots: async (rows) => {
        inserts.push(rows);
      },
      insertSettingsSnapshot: async () => {},
      updateSyncRun: async (_runId, patch) => {
        updateRunCalls.push({
          patch: patch as {
            status: string;
            listingsSynced: number;
            listingsFailed: number;
            errorSummary?: string;
          },
        });
      },
      updateMappingLastSyncedAt: async () => {},
    });

    assert.equal(result.status, 'partial');
    assert.equal(result.status === 'partial' ? result.listingsSynced : null, 1);
    assert.equal(result.status === 'partial' ? result.listingsFailed : null, 1);
    assert.equal(inserts.length, 1);
    const summary = updateRunCalls[0]!.patch.errorSummary ?? '';
    assert.ok(summary.includes('LISTING_TOGGLE_OFF'), `errorSummary should include error_status, got: ${summary}`);
  });

  void it('all-failed when every entry errors', async () => {
    const updateRunCalls: { patch: { status: string; listingsFailed: number } }[] = [];
    const result = await runPriceLabsSyncForOrg(orgId, {
      now: () => new Date('2026-04-21T03:00:00Z'),
      getClient: (): PriceLabsClient => ({
        listListings: async () => [makeListing('pl-1'), makeListing('pl-2')],
        getListingPrices: async () => [
          { id: 'pl-1', pms: 'airbnb', error: 'off', error_status: 'LISTING_TOGGLE_OFF' },
          { id: 'pl-2', pms: 'airbnb', error: 'off', error_status: 'LISTING_TOGGLE_OFF' },
        ],
      }),
      createSyncRun: async () => 'run-1',
      getActiveMappings: async () => [
        { pricelabsListingId: 'pl-1', propertyId: 'prop-1' },
        { pricelabsListingId: 'pl-2', propertyId: 'prop-2' },
      ],
      insertSnapshots: async () => {},
      insertSettingsSnapshot: async () => {},
      updateSyncRun: async (_runId, patch) => {
        updateRunCalls.push({
          patch: patch as { status: string; listingsFailed: number },
        });
      },
      updateMappingLastSyncedAt: async () => {},
    });
    assert.equal(result.status, 'failed');
    assert.equal(updateRunCalls.length, 1);
    assert.equal(updateRunCalls[0]!.patch.listingsFailed, 2);
  });
});
