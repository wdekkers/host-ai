import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { Listing } from '@walt/pricelabs';

import {
  handleGetMappings,
  handleSaveMappings,
  type GetDeps,
  type InternalPropertyRow,
  type MappingUpsertRow,
  type StoredCredentials,
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

function stubClient(listings: Listing[]): GetDeps['createClient'] {
  return () => ({
    listListings: async () => listings,
    getRecommendedRates: async () => notImplemented(),
    getSettings: async () => notImplemented(),
  });
}

void describe('handleGetMappings', () => {
  void it('401s when unauthenticated', async () => {
    const res = await handleGetMappings(makeRequest('GET'), {
      getActor: async () => null,
    });
    assert.equal(res.status, 401);
  });

  void it('returns not_connected when no credentials', async () => {
    const res = await handleGetMappings(makeRequest('GET'), {
      getActor: async () => ownerActor,
      getCredentials: async () => null,
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { state: string };
    assert.equal(body.state, 'not_connected');
  });

  void it('returns key_invalid when credential status is invalid', async () => {
    const creds: StoredCredentials = {
      fingerprint: 'abcd',
      status: 'invalid',
      encryptedApiKey: 'whatever',
    };
    const res = await handleGetMappings(makeRequest('GET'), {
      getActor: async () => ownerActor,
      getCredentials: async () => creds,
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { state: string; fingerprint?: string };
    assert.equal(body.state, 'key_invalid');
    assert.equal(body.fingerprint, 'abcd');
  });

  void it('returns rows with auto-matches joined with stored mappings', async () => {
    const creds: StoredCredentials = {
      fingerprint: 'abcd',
      status: 'active',
      encryptedApiKey: 'ciphertext',
    };
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

    const res = await handleGetMappings(makeRequest('GET'), {
      getActor: async () => ownerActor,
      getCredentials: async () => creds,
      decryptKey: () => 'plain-key',
      createClient: stubClient(listings),
      getProperties: async () => props,
      getStoredMappings: async () => stored,
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      state: string;
      fingerprint?: string;
      rows: Array<{
        pricelabsListingId: string;
        pricelabsListingName: string;
        propertyId: string | null;
        status: string;
        matchConfidence: string | null;
      }>;
    };
    assert.equal(body.state, 'connected');
    assert.equal(body.fingerprint, 'abcd');
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
