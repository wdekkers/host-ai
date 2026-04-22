import {
  PriceLabsError,
  type Listing,
  type ListingPricesEntry,
  type PriceLabsClient,
} from '@walt/pricelabs';

export type SyncDeps = {
  now?: () => Date;
  getClient: () => PriceLabsClient | null;
  createSyncRun: (orgId: string, startedAt: Date) => Promise<string>;
  getActiveMappings: (
    orgId: string,
  ) => Promise<{ pricelabsListingId: string; propertyId: string | null }[]>;
  insertSnapshots: (
    rows: {
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
    }[],
  ) => Promise<void>;
  insertSettingsSnapshot: (row: {
    orgId: string;
    pricelabsListingId: string;
    syncRunId: string;
    settingsBlob: unknown;
  }) => Promise<void>;
  updateSyncRun: (
    runId: string,
    patch: {
      completedAt: Date;
      status: 'success' | 'partial' | 'failed';
      listingsSynced: number;
      listingsFailed: number;
      errorSummary?: string;
    },
  ) => Promise<void>;
  updateMappingLastSyncedAt: (pricelabsListingId: string, at: Date) => Promise<void>;
};

export type SyncResult =
  | { status: 'skipped_not_configured' }
  | {
      status: 'success' | 'partial' | 'failed';
      runId: string;
      listingsSynced: number;
      listingsFailed: number;
    };

function isSuccessEntry(
  entry: ListingPricesEntry,
): entry is Extract<ListingPricesEntry, { data: unknown }> {
  return 'data' in entry;
}

function dollarsToCents(value: number | null | undefined): number {
  if (value == null) return 0;
  return Math.round(value * 100);
}

function publishedPriceFromUserPrice(userPrice: number | undefined): number | null {
  // PriceLabs uses -1 as the sentinel for "no host override".
  if (userPrice == null || userPrice < 0) return null;
  return Math.round(userPrice * 100);
}

function buildSnapshotRows(
  orgId: string,
  listing: Listing | undefined,
  entry: Extract<ListingPricesEntry, { data: unknown }>,
  syncRunId: string,
): Parameters<SyncDeps['insertSnapshots']>[0] {
  const basePrice = dollarsToCents(listing?.base ?? null);
  const minPrice = dollarsToCents(listing?.min ?? null);
  const maxPrice = dollarsToCents(listing?.max ?? null);

  return entry.data.map((r) => ({
    orgId,
    pricelabsListingId: entry.id,
    date: r.date,
    recommendedPrice: Math.round(r.price * 100),
    publishedPrice: publishedPriceFromUserPrice(r.user_price),
    basePrice,
    minPrice,
    maxPrice,
    minStay: r.min_stay ?? null,
    closedToArrival: false,
    closedToDeparture: false,
    isBooked: (r.booking_status ?? '') !== '',
    syncRunId,
  }));
}

export async function runPriceLabsSyncForOrg(
  orgId: string,
  deps: SyncDeps,
): Promise<SyncResult> {
  const now = (deps.now ?? (() => new Date()))();
  const client = deps.getClient();
  if (!client) return { status: 'skipped_not_configured' };

  const runId = await deps.createSyncRun(orgId, now);

  // Step 1: fetch all listings (validates the API key and gives us pms + min/base/max).
  let listings: Listing[];
  try {
    listings = await client.listListings();
  } catch (err) {
    const code = err instanceof PriceLabsError ? err.code : 'unknown';
    if (code === 'auth_rejected') {
      console.error(
        `[pricelabs-sync] org=${orgId} auth_rejected — check PRICELABS_API_KEY env var`,
      );
    }
    await deps.updateSyncRun(runId, {
      completedAt: new Date(),
      status: 'failed',
      listingsSynced: 0,
      listingsFailed: 0,
      errorSummary: code,
    });
    return { status: 'failed', runId, listingsSynced: 0, listingsFailed: 0 };
  }

  const listingById = new Map(listings.map((l) => [l.id, l]));
  const mappings = await deps.getActiveMappings(orgId);

  // Step 2: build POST body by looking up each mapping's pms from the live listings response.
  const payload = mappings
    .map((m) => {
      const l = listingById.get(m.pricelabsListingId);
      if (!l) return null;
      return { id: m.pricelabsListingId, pms: l.pms, mapping: m, listing: l };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  let synced = 0;
  let failed = 0;
  const failures: string[] = [];

  // Mappings that didn't match any live listing (e.g. removed from PriceLabs side).
  for (const m of mappings) {
    if (!listingById.has(m.pricelabsListingId)) {
      failed++;
      failures.push(`${m.pricelabsListingId}:not_in_pricelabs`);
    }
  }

  if (payload.length === 0) {
    const status: 'success' | 'partial' | 'failed' = failed === 0 ? 'success' : 'failed';
    await deps.updateSyncRun(runId, {
      completedAt: new Date(),
      status,
      listingsSynced: 0,
      listingsFailed: failed,
      errorSummary: failures.length ? failures.join('; ').slice(0, 1000) : undefined,
    });
    return { status, runId, listingsSynced: 0, listingsFailed: failed };
  }

  // Step 3: one batched POST for all mapped listings.
  let entries: ListingPricesEntry[];
  try {
    entries = await client.getListingPrices(
      payload.map(({ id, pms }) => ({ id, pms })),
    );
  } catch (err) {
    const code = err instanceof PriceLabsError ? err.code : 'unknown';
    await deps.updateSyncRun(runId, {
      completedAt: new Date(),
      status: 'failed',
      listingsSynced: 0,
      listingsFailed: mappings.length,
      errorSummary: `listing_prices:${code}`,
    });
    return {
      status: 'failed',
      runId,
      listingsSynced: 0,
      listingsFailed: mappings.length,
    };
  }

  const entryById = new Map(entries.map((e) => [e.id, e]));

  // Step 4: per-listing insert; error entries count as failures.
  for (const { id: listingId, listing, mapping } of payload) {
    const entry = entryById.get(listingId);
    if (!entry) {
      failed++;
      failures.push(`${listingId}:missing_from_response`);
      continue;
    }
    if (!isSuccessEntry(entry)) {
      failed++;
      failures.push(`${listingId}:${entry.error_status ?? 'error'}`);
      continue;
    }
    try {
      const rows = buildSnapshotRows(orgId, listing, entry, runId);
      await deps.insertSnapshots(rows);
      // Snapshot the full top-level listing as our "settings" record (min/base/max live here).
      await deps.insertSettingsSnapshot({
        orgId,
        pricelabsListingId: listingId,
        syncRunId: runId,
        settingsBlob: listing,
      });
      await deps.updateMappingLastSyncedAt(mapping.pricelabsListingId, now);
      synced++;
    } catch (err) {
      failed++;
      const code = err instanceof PriceLabsError ? err.code : 'unknown';
      failures.push(`${listingId}:${code}`);
    }
  }

  const status: 'success' | 'partial' | 'failed' =
    failed === 0 ? 'success' : synced === 0 ? 'failed' : 'partial';
  await deps.updateSyncRun(runId, {
    completedAt: new Date(),
    status,
    listingsSynced: synced,
    listingsFailed: failed,
    errorSummary: failures.length ? failures.join('; ').slice(0, 1000) : undefined,
  });

  return { status, runId, listingsSynced: synced, listingsFailed: failed };
}
