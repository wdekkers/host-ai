import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { pricelabsListings, properties } from '@walt/db';
import { PriceLabsError, type PriceLabsClient } from '@walt/pricelabs';

import { getPriceLabsClient } from '@/lib/pricelabs/get-client';
import { autoMatchListings } from '@/lib/pricelabs/auto-match';
import { resolveActor, type Actor } from '@/lib/auth/resolve-actor';

// `integrations.read` is the only integrations-scoped permission currently
// defined in `@walt/contracts`; owners implicitly have all permissions and
// managers are explicitly granted it in `lib/auth/permissions.ts`.
const INTEGRATIONS_PERMISSION = 'integrations.read' as const;

export type { Actor };

export type InternalPropertyRow = { id: string; name: string };

export type StoredMappingRow = {
  pricelabsListingId: string;
  propertyId: string | null;
  status: string;
  matchConfidence: string | null;
};

export type MappingUpsertRow = {
  orgId: string;
  pricelabsListingId: string;
  pricelabsListingName: string;
  propertyId: string | null;
  status: 'active' | 'unmapped' | 'inactive';
  matchConfidence: 'manual';
};

export type GetDeps = {
  // Test-only override. Production callers go through `requirePermission`.
  getActor?: (req: Request) => Promise<Actor | null>;
  getClient?: () => PriceLabsClient | null;
  getProperties?: (orgId: string) => Promise<InternalPropertyRow[]>;
  getStoredMappings?: (orgId: string) => Promise<StoredMappingRow[]>;
};

export type SaveDeps = {
  // Test-only override. Production callers go through `requirePermission`.
  getActor?: (req: Request) => Promise<Actor | null>;
  upsertMappings?: (rows: MappingUpsertRow[]) => Promise<void>;
};

export async function handleGetMappings(
  req: Request,
  deps: GetDeps = {},
): Promise<Response> {
  const actorOrResponse = await resolveActor(req, INTEGRATIONS_PERMISSION, deps.getActor);
  if (actorOrResponse instanceof Response) {
    return actorOrResponse;
  }
  const actor = actorOrResponse;

  const client = (deps.getClient ?? getPriceLabsClient)();
  if (!client) {
    return NextResponse.json({ state: 'not_configured' });
  }

  let listings;
  try {
    listings = await client.listListings();
  } catch (err) {
    if (err instanceof PriceLabsError) {
      console.error('[pricelabs-mappings] upstream error', {
        code: err.code,
        cause: err.cause,
      });
      if (err.code === 'auth_rejected') {
        return NextResponse.json({
          state: 'key_invalid',
          error: 'PriceLabs rejected the API key',
        });
      }
      return NextResponse.json({
        state: 'upstream_error',
        error: err.message,
        code: err.code,
        debug: err.cause,
      });
    }
    throw err;
  }

  // PriceLabs may return listings that aren't actively syncing (push_enabled=false)
  // — filter them out of the mapping UI so hosts don't try to map dead listings.
  const totalListings = listings.length;
  const visibleListings = listings.filter((l) => l.push_enabled === true);
  const hiddenCount = totalListings - visibleListings.length;

  const getProperties =
    deps.getProperties ??
    (async (_orgId: string) => {
      const { db } = await import('@/lib/db');
      const rows = await db.select({ id: properties.id, name: properties.name }).from(properties);
      return rows;
    });

  const getStored =
    deps.getStoredMappings ??
    (async (orgId: string) => {
      const { db } = await import('@/lib/db');
      const rows = await db
        .select({
          pricelabsListingId: pricelabsListings.pricelabsListingId,
          propertyId: pricelabsListings.propertyId,
          status: pricelabsListings.status,
          matchConfidence: pricelabsListings.matchConfidence,
        })
        .from(pricelabsListings)
        .where(eq(pricelabsListings.orgId, orgId));
      return rows;
    });

  const [props, stored] = await Promise.all([
    getProperties(actor.orgId),
    getStored(actor.orgId),
  ]);
  const storedByListing = new Map(stored.map((r) => [r.pricelabsListingId, r]));

  const unmappedListings = visibleListings
    .filter((l) => !storedByListing.has(l.id))
    .map((l) => ({ id: l.id, name: l.name }));
  const takenProps = new Set(
    stored.filter((r) => r.propertyId).map((r) => r.propertyId as string),
  );
  const availableProps = props.filter((p) => !takenProps.has(p.id));
  const autoMatches = autoMatchListings(unmappedListings, availableProps);
  const autoByListing = new Map(autoMatches.map((m) => [m.pricelabsListingId, m]));

  const rows = visibleListings.map((l) => {
    const saved = storedByListing.get(l.id);
    if (saved) {
      return {
        pricelabsListingId: l.id,
        pricelabsListingName: l.name,
        propertyId: saved.propertyId,
        status: saved.status,
        matchConfidence: saved.matchConfidence,
      };
    }
    const auto = autoByListing.get(l.id);
    return {
      pricelabsListingId: l.id,
      pricelabsListingName: l.name,
      propertyId: auto?.propertyId ?? null,
      status: 'unmapped' as const,
      matchConfidence: auto?.confidence ?? null,
    };
  });

  return NextResponse.json({
    state: 'connected',
    rows,
    hiddenCount,
  });
}

const SaveBody = z.object({
  mappings: z
    .array(
      z.object({
        pricelabsListingId: z.string().min(1),
        pricelabsListingName: z.string().min(1),
        propertyId: z.string().nullable(),
        status: z.enum(['active', 'unmapped', 'inactive']),
      }),
    )
    .min(0),
});

export async function handleSaveMappings(
  req: Request,
  deps: SaveDeps = {},
): Promise<Response> {
  const actorOrResponse = await resolveActor(req, INTEGRATIONS_PERMISSION, deps.getActor);
  if (actorOrResponse instanceof Response) {
    return actorOrResponse;
  }
  const actor = actorOrResponse;

  const json = await req.json().catch(() => null);
  const parsed = SaveBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid body' },
      { status: 400 },
    );
  }

  const rows: MappingUpsertRow[] = parsed.data.mappings.map((m) => ({
    orgId: actor.orgId,
    pricelabsListingId: m.pricelabsListingId,
    pricelabsListingName: m.pricelabsListingName,
    propertyId: m.propertyId,
    status: m.status,
    matchConfidence: 'manual' as const,
  }));

  const upsert =
    deps.upsertMappings ??
    (async (rowsToInsert: MappingUpsertRow[]) => {
      const { db } = await import('@/lib/db');
      for (const r of rowsToInsert) {
        await db
          .insert(pricelabsListings)
          .values({
            orgId: r.orgId,
            pricelabsListingId: r.pricelabsListingId,
            pricelabsListingName: r.pricelabsListingName,
            propertyId: r.propertyId,
            status: r.status,
            matchConfidence: r.matchConfidence,
          })
          .onConflictDoUpdate({
            target: [pricelabsListings.orgId, pricelabsListings.pricelabsListingId],
            set: {
              pricelabsListingName: r.pricelabsListingName,
              propertyId: r.propertyId,
              status: r.status,
              matchConfidence: r.matchConfidence,
              updatedAt: new Date(),
            },
          });
      }
    });

  await upsert(rows);
  return NextResponse.json({ ok: true, count: rows.length });
}
