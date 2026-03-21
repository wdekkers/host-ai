import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { properties, reservations } from '@walt/db';

export const GET = withPermission('reservations.read', async (request) => {
  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end query params required' }, { status: 400 });
  }

  const activeProperties = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(eq(properties.isActive, true))
    .orderBy(asc(properties.name));

  const propertyIds = activeProperties.map((p) => p.id);
  if (propertyIds.length === 0) {
    return NextResponse.json({ properties: [], reservations: [] });
  }

  // Get reservations that overlap with the date range
  const rows = await db
    .select({
      id: reservations.id,
      propertyId: reservations.propertyId,
      guestFirstName: reservations.guestFirstName,
      guestLastName: reservations.guestLastName,
      arrivalDate: reservations.arrivalDate,
      departureDate: reservations.departureDate,
      status: reservations.status,
      platform: reservations.platform,
      totalPrice: reservations.totalPrice,
      nightlyRate: reservations.nightlyRate,
      currency: reservations.currency,
      nights: reservations.nights,
    })
    .from(reservations)
    .where(
      and(
        lte(reservations.arrivalDate, new Date(end)),
        gte(reservations.departureDate, new Date(start)),
      ),
    )
    .orderBy(asc(reservations.arrivalDate));

  // Filter to active properties
  const activePropertySet = new Set(propertyIds);
  const filtered = rows.filter((r) => r.propertyId && activePropertySet.has(r.propertyId));

  return NextResponse.json({ properties: activeProperties, reservations: filtered });
});
