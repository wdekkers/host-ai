import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';

import { pricelabsListings, propertyAccess } from '@walt/db';

import { resolveActor, type Actor } from '@/lib/auth/resolve-actor';

export type SnapshotRow = {
  date: string;
  recommendedPrice: number;
  publishedPrice: number | null;
  isBooked: boolean;
};

export type MappingRow = {
  pricelabsListingId: string;
  lastSyncedAt: Date | null;
};

export type Deps = {
  getActor?: (req: Request) => Promise<Actor | null>;
  userHasAccessToProperty?: (actor: Actor, propertyId: string) => Promise<boolean>;
  getMapping?: (orgId: string, propertyId: string) => Promise<MappingRow | null>;
  getRecentSnapshots?: (
    orgId: string,
    pricelabsListingId: string,
    days: number,
  ) => Promise<SnapshotRow[]>;
};

type RawSnapshot = {
  date: string;
  recommended_price: number;
  published_price: number | null;
  is_booked: boolean;
};

export async function handleGetPricingSnapshots(
  request: Request,
  propertyId: string,
  deps: Deps = {},
): Promise<Response> {
  const actorOrRes = await resolveActor(request, 'integrations.read', deps.getActor);
  if (actorOrRes instanceof Response) return actorOrRes;
  const actor = actorOrRes;

  const userHasAccess =
    deps.userHasAccessToProperty ??
    (async (act: Actor, id: string) => {
      const { db } = await import('@/lib/db');
      const [row] = await db
        .select({ propertyId: propertyAccess.propertyId })
        .from(propertyAccess)
        .where(
          and(
            eq(propertyAccess.organizationId, act.orgId),
            eq(propertyAccess.propertyId, id),
          ),
        )
        .limit(1);
      return !!row;
    });

  if (!(await userHasAccess(actor, propertyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const getMapping =
    deps.getMapping ??
    (async (orgId: string, id: string) => {
      const { db } = await import('@/lib/db');
      const [row] = await db
        .select({
          pricelabsListingId: pricelabsListings.pricelabsListingId,
          lastSyncedAt: pricelabsListings.lastSyncedAt,
        })
        .from(pricelabsListings)
        .where(
          and(
            eq(pricelabsListings.orgId, orgId),
            eq(pricelabsListings.propertyId, id),
            eq(pricelabsListings.status, 'active'),
          ),
        )
        .limit(1);
      return row ?? null;
    });

  const mapping = await getMapping(actor.orgId, propertyId);
  if (!mapping) return NextResponse.json({ state: 'no_mapping' });

  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');
  const days = daysParam
    ? Math.max(1, Math.min(365, parseInt(daysParam, 10) || 90))
    : 90;

  const getSnapshots =
    deps.getRecentSnapshots ??
    (async (orgId: string, listingId: string, d: number) => {
      const { db } = await import('@/lib/db');
      const result = await db.execute(sql`
        SELECT date, recommended_price, published_price, is_booked
        FROM walt.pricing_snapshots
        WHERE org_id = ${orgId}
          AND pricelabs_listing_id = ${listingId}
          AND sync_run_id = (
            SELECT sync_run_id FROM walt.pricing_snapshots
            WHERE org_id = ${orgId} AND pricelabs_listing_id = ${listingId}
            ORDER BY created_at DESC LIMIT 1
          )
          AND date::date >= CURRENT_DATE
          AND date::date < CURRENT_DATE + ${d}
        ORDER BY date ASC
      `);
      const rows = result.rows as RawSnapshot[];
      return rows.map((r) => ({
        date: r.date,
        recommendedPrice: r.recommended_price,
        publishedPrice: r.published_price,
        isBooked: r.is_booked,
      }));
    });

  const snapshots = await getSnapshots(actor.orgId, mapping.pricelabsListingId, days);
  if (snapshots.length === 0) {
    return NextResponse.json({ state: 'pending', listingId: mapping.pricelabsListingId });
  }

  return NextResponse.json({
    state: 'ok',
    listingId: mapping.pricelabsListingId,
    lastSyncedAt: mapping.lastSyncedAt?.toISOString() ?? null,
    days: snapshots,
  });
}
