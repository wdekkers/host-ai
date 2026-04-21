import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { handleGetPricingSnapshots } from './handler';

const actor = { userId: 'u1', orgId: 'org-1', role: 'owner' };

void describe('handleGetPricingSnapshots', () => {
  void it('401 unauthenticated', async () => {
    const res = await handleGetPricingSnapshots(
      new Request('http://t/api/properties/prop-1/pricing-snapshots'),
      'prop-1',
      { getActor: async () => null },
    );
    assert.equal(res.status, 401);
  });

  void it('403 when user has no access to the property', async () => {
    const res = await handleGetPricingSnapshots(
      new Request('http://t/api/properties/prop-1/pricing-snapshots'),
      'prop-1',
      { getActor: async () => actor, userHasAccessToProperty: async () => false },
    );
    assert.equal(res.status, 403);
  });

  void it('returns no_mapping when property has no mapping', async () => {
    const res = await handleGetPricingSnapshots(
      new Request('http://t/api/properties/prop-1/pricing-snapshots'),
      'prop-1',
      {
        getActor: async () => actor,
        userHasAccessToProperty: async () => true,
        getMapping: async () => null,
      },
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { state: 'no_mapping' });
  });

  void it('returns pending when mapping exists but no snapshots', async () => {
    const res = await handleGetPricingSnapshots(
      new Request('http://t/api/properties/prop-1/pricing-snapshots'),
      'prop-1',
      {
        getActor: async () => actor,
        userHasAccessToProperty: async () => true,
        getMapping: async () => ({ pricelabsListingId: 'pl-1', lastSyncedAt: null }),
        getRecentSnapshots: async () => [],
      },
    );
    const body = await res.json();
    assert.deepEqual(body, { state: 'pending', listingId: 'pl-1' });
  });

  void it('returns most recent snapshot window', async () => {
    const res = await handleGetPricingSnapshots(
      new Request('http://t/api/properties/prop-1/pricing-snapshots?days=90'),
      'prop-1',
      {
        getActor: async () => actor,
        userHasAccessToProperty: async () => true,
        getMapping: async () => ({
          pricelabsListingId: 'pl-1',
          lastSyncedAt: new Date('2026-04-21T03:00:00Z'),
        }),
        getRecentSnapshots: async () => [
          { date: '2026-04-21', recommendedPrice: 500, publishedPrice: 550, isBooked: false },
          { date: '2026-04-22', recommendedPrice: 510, publishedPrice: 550, isBooked: true },
        ],
      },
    );
    const body = (await res.json()) as { state: string; listingId: string; days: unknown[] };
    assert.equal(body.state, 'ok');
    assert.equal(body.listingId, 'pl-1');
    assert.equal(body.days.length, 2);
  });
});
