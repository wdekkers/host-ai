import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PriceLabsError, type Listing, type PriceLabsClient } from '@walt/pricelabs';

import {
  handleGetMappings,
  handleSaveMappings,
  type GetDeps,
  type InternalPropertyRow,
  type MappingUpsertRow,
  type StoredMappingRow,
} from './handler';

function notImplemented(): never {
  throw new Error('not implemented in test');
}

function makeRequest(method: 'GET' | 'POST', body?: unknown): Request {
  return new Request('http://test/api/integrations/pricelabs/mappings', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ownerActor = { userId: 'u1', orgId: 'org-1', role: 'owner' };

function stubClient(listings: Listing[]): PriceLabsClient {
  return {
    listListings: async () => listings,
    getRecommendedRates: async () => notImplemented(),
    getSettings: async () => notImplemented(),
  };
}

void describe('handleGetMappings', () => {
  void it('401s when unauthenticated', async () => {
    const res = await handleGetMappings(makeRequest('GET'), {
      getActor: async () => null,
    });
    assert.equal(res.status, 401);
  });

  void it('returns not_configured when env var is missing', async () => {
    const res = await handleGetMappings(makeRequest('GET'), {
      getActor: async () => ownerActor,
      getClient: () => null,
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { state: string };
    assert.equal(body.state, 'not_configured');
  });

  void it('returns key_invalid when listListings throws auth_rejected', async () => {
    const res = await handleGetMappings(makeRequest('GET'), {
      getActor: async () => ownerActor,
      getClient: () => ({
        listListings: async () => {
          throw new PriceLabsError('auth_rejected', 'nope');
        },
        getRecommendedRates: async () => notImplemented(),
        getSettings: async () => notImplemented(),
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { state: string; error: string };
    assert.equal(body.state, 'key_invalid');
    assert.equal(body.error, 'PriceLabs rejected the API key');
  });

  void it('returns upstream_error with debug payload on server_error', async () => {
    const cause = { status: 500, url: 'x', body: 'xyz' };
    const res = await handleGetMappings(makeRequest('GET'), {
      getActor: async () => ownerActor,
      getClient: () => ({
        listListings: async () => {
          throw new PriceLabsError('server_error', 'boom', cause);
        },
        getRecommendedRates: async () => notImplemented(),
        getSettings: async () => notImplemented(),
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      state: string;
      error: string;
      code: string;
      debug: { status: number; url: string; body: string };
    };
    assert.equal(body.state, 'upstream_error');
    assert.equal(body.error, 'boom');
    assert.equal(body.code, 'server_error');
    assert.deepEqual(body.debug, cause);
  });

  void it('returns rows with auto-matches joined with stored mappings', async () => {
    const listings: Listing[] = [
      { id: 'pl-1', name: 'Alpha Beach House' },
      { id: 'pl-2', name: 'Bravo Cabin' },
    ];
    const props: InternalPropertyRow[] = [
      { id: 'prop-1', name: 'Alpha Beach House' },
      { id: 'prop-2', name: 'Bravo Cabin' },
    ];
    const stored: StoredMappingRow[] = [
      {
        pricelabsListingId: 'pl-1',
        propertyId: 'prop-1',
        status: 'active',
        matchConfidence: 'manual',
      },
    ];

    const deps: GetDeps = {
      getActor: async () => ownerActor,
      getClient: () => stubClient(listings),
      getProperties: async () => props,
      getStoredMappings: async () => stored,
    };

    const res = await handleGetMappings(makeRequest('GET'), deps);

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      state: string;
      rows: Array<{
        pricelabsListingId: string;
        pricelabsListingName: string;
        propertyId: string | null;
        status: string;
        matchConfidence: string | null;
      }>;
    };
    assert.equal(body.state, 'connected');
    assert.equal(body.rows.length, 2);

    const row1 = body.rows.find((r) => r.pricelabsListingId === 'pl-1');
    assert.ok(row1, 'row for pl-1 should exist');
    assert.equal(row1.propertyId, 'prop-1');
    assert.equal(row1.status, 'active');
    assert.equal(row1.matchConfidence, 'manual');
    assert.equal(row1.pricelabsListingName, 'Alpha Beach House');

    const row2 = body.rows.find((r) => r.pricelabsListingId === 'pl-2');
    assert.ok(row2, 'row for pl-2 should exist');
    assert.equal(row2.propertyId, 'prop-2');
    assert.equal(row2.status, 'unmapped');
    assert.equal(row2.matchConfidence, 'auto-high');
    assert.equal(row2.pricelabsListingName, 'Bravo Cabin');
  });
});

void describe('handleSaveMappings', () => {
  void it('upserts mappings and stamps matchConfidence=manual on every row', async () => {
    const calls: MappingUpsertRow[][] = [];
    const res = await handleSaveMappings(
      makeRequest('POST', {
        mappings: [
          {
            pricelabsListingId: 'pl-1',
            pricelabsListingName: 'Alpha',
            propertyId: 'prop-1',
            status: 'active',
          },
          {
            pricelabsListingId: 'pl-2',
            pricelabsListingName: 'Bravo',
            propertyId: null,
            status: 'unmapped',
          },
        ],
      }),
      {
        getActor: async () => ownerActor,
        upsertMappings: async (rows) => {
          calls.push(rows);
        },
      },
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; count: number };
    assert.equal(body.ok, true);
    assert.equal(body.count, 2);

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], [
      {
        orgId: 'org-1',
        pricelabsListingId: 'pl-1',
        pricelabsListingName: 'Alpha',
        propertyId: 'prop-1',
        status: 'active',
        matchConfidence: 'manual',
      },
      {
        orgId: 'org-1',
        pricelabsListingId: 'pl-2',
        pricelabsListingName: 'Bravo',
        propertyId: null,
        status: 'unmapped',
        matchConfidence: 'manual',
      },
    ]);
  });

  void it('400s on invalid body', async () => {
    const res = await handleSaveMappings(
      makeRequest('POST', { mappings: 'not-array' }),
      {
        getActor: async () => ownerActor,
        upsertMappings: async () => {
          throw new Error('should not be called');
        },
      },
    );
    assert.equal(res.status, 400);
  });
});
