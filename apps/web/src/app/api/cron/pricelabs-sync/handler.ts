import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import {
  pricelabsCredentials,
  pricelabsListings,
  pricelabsSyncRuns,
  pricingSnapshots,
  pricelabsSettingsSnapshots,
  reservations,
} from '@walt/db';
import { createPriceLabsClient } from '@walt/pricelabs';
import { decryptApiKey } from '@/lib/pricelabs/encryption';
import { runPriceLabsSyncForOrg, type SyncResult } from '@/lib/pricelabs/sync';

export type CronDeps = {
  cronSecret?: string;
  getOrgsWithCredentials?: () => Promise<{ orgId: string }[]>;
  runForOrg?: (orgId: string) => Promise<SyncResult>;
};

export async function handleCronSync(request: Request, deps: CronDeps = {}): Promise<Response> {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const getOrgs = deps.getOrgsWithCredentials ?? (async () => {
    const { db } = await import('@/lib/db');
    return db
      .select({ orgId: pricelabsCredentials.orgId })
      .from(pricelabsCredentials)
      .where(eq(pricelabsCredentials.status, 'active'));
  });

  const runForOrg = deps.runForOrg ?? defaultRunForOrg;

  const orgs = await getOrgs();
  const results: {
    orgId: string;
    status: string;
    runId?: string;
    listingsSynced?: number;
    listingsFailed?: number;
  }[] = [];

  for (const { orgId } of orgs) {
    try {
      const result = await runForOrg(orgId);
      console.log(`[pricelabs-sync] org=${orgId} done`, result);
      if (result.status === 'skipped_no_credentials') {
        results.push({ orgId, status: 'skipped' });
      } else {
        results.push({
          orgId,
          status: result.status,
          runId: result.runId,
          listingsSynced: result.listingsSynced,
          listingsFailed: result.listingsFailed,
        });
      }
    } catch (err) {
      console.error(`[pricelabs-sync] org=${orgId} threw`, err);
      results.push({ orgId, status: 'failed' });
    }
  }
  return NextResponse.json({ orgCount: orgs.length, results });
}

async function defaultRunForOrg(orgId: string): Promise<SyncResult> {
  const { db } = await import('@/lib/db');
  return runPriceLabsSyncForOrg(orgId, {
    getCredentials: async (id) => {
      const [row] = await db
        .select({ encryptedApiKey: pricelabsCredentials.encryptedApiKey })
        .from(pricelabsCredentials)
        .where(eq(pricelabsCredentials.orgId, id))
        .limit(1);
      return row ?? null;
    },
    decryptKey: decryptApiKey,
    createClient: (key) => createPriceLabsClient({ apiKey: key }),
    createSyncRun: async (id, startedAt) => {
      const [row] = await db
        .insert(pricelabsSyncRuns)
        .values({ orgId: id, startedAt, status: 'running' })
        .returning({ id: pricelabsSyncRuns.id });
      if (!row) throw new Error('createSyncRun returned no row');
      return row.id;
    },
    getActiveMappings: async (id) => {
      const rows = await db
        .select({
          pricelabsListingId: pricelabsListings.pricelabsListingId,
          propertyId: pricelabsListings.propertyId,
        })
        .from(pricelabsListings)
        .where(eq(pricelabsListings.orgId, id));
      return rows.filter((r) => r.pricelabsListingId);
    },
    getReservations: async (propertyIds) => {
      if (propertyIds.length === 0) return [];
      return db
        .select({
          propertyId: reservations.propertyId,
          arrivalDate: reservations.arrivalDate,
          departureDate: reservations.departureDate,
        })
        .from(reservations)
        .where(inArray(reservations.propertyId, propertyIds));
    },
    insertSnapshots: async (rows) => {
      if (rows.length === 0) return;
      await db.insert(pricingSnapshots).values(rows);
    },
    insertSettingsSnapshot: async (row) => {
      await db.insert(pricelabsSettingsSnapshots).values({
        orgId: row.orgId,
        pricelabsListingId: row.pricelabsListingId,
        syncRunId: row.syncRunId,
        settingsBlob: row.settingsBlob as never,
      });
    },
    updateSyncRun: async (runId, patch) => {
      await db.update(pricelabsSyncRuns).set(patch).where(eq(pricelabsSyncRuns.id, runId));
    },
    updateMappingLastSyncedAt: async (pricelabsListingId, at) => {
      await db
        .update(pricelabsListings)
        .set({ lastSyncedAt: at })
        .where(eq(pricelabsListings.pricelabsListingId, pricelabsListingId));
    },
    markCredentialsInvalid: async (id) => {
      await db
        .update(pricelabsCredentials)
        .set({ status: 'invalid', updatedAt: new Date() })
        .where(eq(pricelabsCredentials.orgId, id));
    },
  });
}
