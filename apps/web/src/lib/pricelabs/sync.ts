import { PriceLabsError, type PriceLabsClient, type DailyRate } from '@walt/pricelabs';

export type SyncDeps = {
  now?: () => Date;
  getCredentials: (orgId: string) => Promise<{ encryptedApiKey: string } | null>;
  decryptKey?: (encrypted: string) => string;
  createClient: (apiKey: string) => PriceLabsClient;
  createSyncRun: (orgId: string, startedAt: Date) => Promise<string>;
  getActiveMappings: (orgId: string) => Promise<{ pricelabsListingId: string; propertyId: string | null }[]>;
  getReservations: (propertyIds: string[]) => Promise<{ propertyId: string | null; arrivalDate: Date | null; departureDate: Date | null }[]>;
  insertSnapshots: (rows: {
    orgId: string;
    pricelabsListingId: string;
    date: string;
    recommendedPrice: number;
    publishedPrice: number | null;
    basePrice: number;
    minPrice: number;
    maxPrice: number;
    minStay: number | null;
    closedToArrival: boolean;
    closedToDeparture: boolean;
    isBooked: boolean;
    syncRunId: string;
  }[]) => Promise<void>;
  insertSettingsSnapshot: (row: { orgId: string; pricelabsListingId: string; syncRunId: string; settingsBlob: unknown }) => Promise<void>;
  updateSyncRun: (runId: string, patch: {
    completedAt: Date;
    status: 'success' | 'partial' | 'failed';
    listingsSynced: number;
    listingsFailed: number;
    errorSummary?: string;
  }) => Promise<void>;
  updateMappingLastSyncedAt: (pricelabsListingId: string, at: Date) => Promise<void>;
  markCredentialsInvalid: (orgId: string) => Promise<void>;
};

export type SyncResult =
  | { status: 'skipped_no_credentials' }
  | { status: 'success' | 'partial' | 'failed'; runId: string; listingsSynced: number; listingsFailed: number };

const FORWARD_DAYS = 365;

function addDaysIso(base: Date, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeBookedDates(
  reservations: { propertyId: string | null; arrivalDate: Date | null; departureDate: Date | null }[],
  propertyId: string | null,
): Set<string> {
  const set = new Set<string>();
  if (!propertyId) return set;
  for (const r of reservations) {
    if (r.propertyId !== propertyId || !r.arrivalDate || !r.departureDate) continue;
    const cursor = new Date(r.arrivalDate);
    while (cursor < r.departureDate) {
      set.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return set;
}

function buildSnapshotRows(
  orgId: string,
  pricelabsListingId: string,
  rates: DailyRate[],
  bookedDates: Set<string>,
  syncRunId: string,
): Parameters<SyncDeps['insertSnapshots']>[0] {
  return rates.map((r) => ({
    orgId,
    pricelabsListingId,
    date: r.date,
    recommendedPrice: r.recommendedPrice,
    publishedPrice: r.publishedPrice ?? null,
    basePrice: r.basePrice,
    minPrice: r.minPrice,
    maxPrice: r.maxPrice,
    minStay: r.minStay ?? null,
    closedToArrival: r.closedToArrival ?? false,
    closedToDeparture: r.closedToDeparture ?? false,
    isBooked: bookedDates.has(r.date),
    syncRunId,
  }));
}

export async function runPriceLabsSyncForOrg(orgId: string, deps: SyncDeps): Promise<SyncResult> {
  const now = (deps.now ?? (() => new Date()))();
  const creds = await deps.getCredentials(orgId);
  if (!creds) return { status: 'skipped_no_credentials' };

  const runId = await deps.createSyncRun(orgId, now);

  const apiKey = (deps.decryptKey ?? ((x) => x))(creds.encryptedApiKey);
  const client = deps.createClient(apiKey);

  // Validate key first.
  try {
    await client.listListings();
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth_rejected') {
      await deps.markCredentialsInvalid(orgId);
    }
    await deps.updateSyncRun(runId, {
      completedAt: new Date(),
      status: 'failed',
      listingsSynced: 0,
      listingsFailed: 0,
      errorSummary: code ?? 'unknown',
    });
    return { status: 'failed', runId, listingsSynced: 0, listingsFailed: 0 };
  }

  const mappings = await deps.getActiveMappings(orgId);
  const propertyIds = mappings.map((m) => m.propertyId).filter((x): x is string => !!x);
  const reservations = propertyIds.length > 0 ? await deps.getReservations(propertyIds) : [];

  const startDate = addDaysIso(now, 0);
  const endDate = addDaysIso(now, FORWARD_DAYS);

  let synced = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const mapping of mappings) {
    try {
      const [rates, settings] = await Promise.all([
        client.getRecommendedRates(mapping.pricelabsListingId, startDate, endDate),
        client.getSettings(mapping.pricelabsListingId),
      ]);
      const booked = computeBookedDates(reservations, mapping.propertyId);
      const rows = buildSnapshotRows(orgId, mapping.pricelabsListingId, rates, booked, runId);
      await deps.insertSnapshots(rows);
      await deps.insertSettingsSnapshot({
        orgId,
        pricelabsListingId: mapping.pricelabsListingId,
        syncRunId: runId,
        settingsBlob: settings,
      });
      await deps.updateMappingLastSyncedAt(mapping.pricelabsListingId, now);
      synced++;
    } catch (err) {
      failed++;
      const code = err instanceof PriceLabsError ? err.code : 'unknown';
      failures.push(`${mapping.pricelabsListingId}:${code}`);
    }
  }

  const status: 'success' | 'partial' | 'failed' = failed === 0 ? 'success' : synced === 0 ? 'failed' : 'partial';
  await deps.updateSyncRun(runId, {
    completedAt: new Date(),
    status,
    listingsSynced: synced,
    listingsFailed: failed,
    errorSummary: failures.length ? failures.join('; ').slice(0, 1000) : undefined,
  });

  return { status, runId, listingsSynced: synced, listingsFailed: failed };
}
