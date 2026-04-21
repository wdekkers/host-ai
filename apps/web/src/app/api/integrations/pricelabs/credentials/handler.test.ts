import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { handleSaveCredentials, handleDeleteCredentials } from './handler';

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://test/api/integrations/pricelabs/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function notImplemented(): never {
  throw new Error('not implemented in test');
}

void describe('handleSaveCredentials', () => {
  before(() => {
    process.env.PRICELABS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  });

  void it('401s when no auth', async () => {
    const res = await handleSaveCredentials(makeRequest({ apiKey: 'x' }), {
      getActor: async () => null,
    });
    assert.equal(res.status, 401);
  });

  void it('403s when actor has insufficient role', async () => {
    const res = await handleSaveCredentials(makeRequest({ apiKey: 'x' }), {
      getActor: async () => ({ userId: 'u1', orgId: 'org-1', role: 'viewer' }),
    });
    assert.equal(res.status, 403);
  });

  void it('400s on empty key', async () => {
    const res = await handleSaveCredentials(makeRequest({ apiKey: '' }), {
      getActor: async () => ({ userId: 'u1', orgId: 'org-1', role: 'owner' }),
    });
    assert.equal(res.status, 400);
  });

  void it('400s when PriceLabs rejects the key', async () => {
    const res = await handleSaveCredentials(makeRequest({ apiKey: 'bad' }), {
      getActor: async () => ({ userId: 'u1', orgId: 'org-1', role: 'owner' }),
      createClient: () => ({
        listListings: async () => {
          const err: Error & { code?: string } = new Error('unauthorized');
          err.name = 'PriceLabsError';
          err.code = 'auth_rejected';
          throw err;
        },
        getRecommendedRates: async () => notImplemented(),
        getSettings: async () => notImplemented(),
      }),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: string };
    assert.ok(typeof body.error === 'string');
    assert.match(body.error, /rejected/i);
  });

  void it('stores encrypted credentials on success', async () => {
    const upsertCalls: Array<{
      orgId: string;
      encryptedApiKey: string;
      apiKeyFingerprint: string;
    }> = [];
    const apiKey = 'pl-live-good-key-1234';

    const res = await handleSaveCredentials(makeRequest({ apiKey }), {
      getActor: async () => ({ userId: 'u1', orgId: 'org-1', role: 'owner' }),
      createClient: () => ({
        listListings: async () => [{ id: 'pl-1', name: 'Demo', active: true }],
        getRecommendedRates: async () => notImplemented(),
        getSettings: async () => notImplemented(),
      }),
      upsertCredentials: async (row) => {
        upsertCalls.push(row);
      },
    });

    assert.equal(res.status, 200);
    assert.equal(upsertCalls.length, 1);
    const arg = upsertCalls[0]!;
    assert.equal(arg.orgId, 'org-1');
    assert.equal(typeof arg.encryptedApiKey, 'string');
    assert.notEqual(arg.encryptedApiKey, apiKey);
    assert.equal(arg.apiKeyFingerprint, '1234');
  });
});

void describe('handleDeleteCredentials', () => {
  void it('deletes on DELETE with owner role', async () => {
    const deleteCalls: string[] = [];
    const res = await handleDeleteCredentials(
      new Request('http://test/api/integrations/pricelabs/credentials', { method: 'DELETE' }),
      {
        getActor: async () => ({ userId: 'u1', orgId: 'org-1', role: 'owner' }),
        deleteCredentials: async (orgId) => {
          deleteCalls.push(orgId);
        },
      },
    );
    assert.equal(res.status, 204);
    assert.equal(deleteCalls.length, 1);
    assert.equal(deleteCalls[0], 'org-1');
  });
});
