import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleCronSync } from './handler';
import type { SyncResult } from '@/lib/pricelabs/sync';

const authed = (): Request => new Request('http://test/api/cron/pricelabs-sync', {
  method: 'POST',
  headers: { authorization: 'Bearer test-secret' },
});

void describe('handleCronSync', () => {
  void it('401 without bearer', async () => {
    const res = await handleCronSync(new Request('http://test/api/cron/pricelabs-sync', { method: 'POST' }), {
      cronSecret: 'test-secret',
      getOrgsWithActiveMappings: async () => [],
      runForOrg: async () => ({ status: 'success', runId: 'r', listingsSynced: 0, listingsFailed: 0 }),
    });
    assert.equal(res.status, 401);
  });

  void it('fans out across orgs', async () => {
    const orgsSeen: string[] = [];
    const res = await handleCronSync(authed(), {
      cronSecret: 'test-secret',
      getOrgsWithActiveMappings: async () => [{ orgId: 'org-1' }, { orgId: 'org-2' }],
      runForOrg: async (id) => {
        orgsSeen.push(id);
        return { status: 'success', runId: 'r', listingsSynced: 1, listingsFailed: 0 };
      },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(orgsSeen, ['org-1', 'org-2']);
  });

  void it('one org failing does not prevent the next', async () => {
    let call = 0;
    const res = await handleCronSync(authed(), {
      cronSecret: 'test-secret',
      getOrgsWithActiveMappings: async () => [{ orgId: 'org-1' }, { orgId: 'org-2' }],
      runForOrg: async () => {
        call++;
        if (call === 1) throw new Error('boom');
        return { status: 'success' as const, runId: 'r', listingsSynced: 1, listingsFailed: 0 };
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { results: { orgId: string; status: string }[] };
    assert.equal(body.results.find((r) => r.orgId === 'org-1')?.status, 'failed');
    assert.equal(body.results.find((r) => r.orgId === 'org-2')?.status, 'success');
  });

  void it('maps skipped_not_configured to skipped status', async () => {
    const res = await handleCronSync(authed(), {
      cronSecret: 'test-secret',
      getOrgsWithActiveMappings: async () => [{ orgId: 'org-1' }],
      runForOrg: async () => ({ status: 'skipped_not_configured' } as const satisfies SyncResult),
    });
    const body = await res.json() as { results: { orgId: string; status: string }[] };
    assert.equal(body.results[0]?.status, 'skipped');
  });
});
