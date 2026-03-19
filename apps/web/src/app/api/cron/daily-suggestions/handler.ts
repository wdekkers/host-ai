import { NextResponse } from 'next/server';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { reservations, properties, propertyAccess, taskSuggestions, organizationMemberships } from '@walt/db';

type Deps = {
  cronSecret?: string;
  getOrganizations?: () => Promise<Array<{ organizationId: string }>>;
  getPropertyIds?: (orgId: string) => Promise<string[]>;
  getArrivingReservations?: (propertyIds: string[], today: Date, tomorrow: Date) => Promise<Array<{
    id: string;
    propertyId: string | null;
    guestFirstName: string | null;
    arrivalDate: Date | null;
  }>>;
  getPropertyPool?: (propertyId: string) => Promise<boolean>;
  getPropertyName?: (propertyId: string) => Promise<string>;
  insertSuggestion?: (row: Record<string, unknown>) => Promise<void>;
};

export async function handleDailySuggestions(request: Request, deps: Deps = {}) {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');

  const getOrganizations = deps.getOrganizations ?? (async () =>
    db.selectDistinct({ organizationId: organizationMemberships.organizationId }).from(organizationMemberships)
  );

  const getPropertyIds = deps.getPropertyIds ?? (async (orgId: string) => {
    const rows = await db
      .select({ propertyId: propertyAccess.propertyId })
      .from(propertyAccess)
      .where(eq(propertyAccess.organizationId, orgId));
    return rows.map((r) => r.propertyId);
  });

  const getArrivingReservations = deps.getArrivingReservations ?? (async (propertyIds: string[], today: Date, tomorrow: Date) => {
    if (propertyIds.length === 0) return [];
    return db
      .select()
      .from(reservations)
      .where(
        and(
          inArray(reservations.propertyId, propertyIds),
          or(
            sql`${reservations.arrivalDate}::date = ${today.toISOString().slice(0, 10)}::date`,
            sql`${reservations.arrivalDate}::date = ${tomorrow.toISOString().slice(0, 10)}::date`,
          ),
        ),
      );
  });

  const getPropertyPool = deps.getPropertyPool ?? (async (propertyId: string) => {
    const [row] = await db.select({ hasPool: properties.hasPool }).from(properties).where(eq(properties.id, propertyId)).limit(1);
    return row?.hasPool ?? false;
  });

  const getPropertyName = deps.getPropertyName ?? (async (propertyId: string) => {
    const [row] = await db.select({ name: properties.name }).from(properties).where(eq(properties.id, propertyId)).limit(1);
    return row?.name ?? propertyId;
  });

  const insertSuggestion = deps.insertSuggestion ?? (async (row: Record<string, unknown>) => {
    await db.insert(taskSuggestions).values(row as never).onConflictDoNothing();
  });

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(today.getUTCDate() + 1);

  const orgs = await getOrganizations();
  let inserted = 0;

  for (const { organizationId } of orgs) {
    const propertyIds = await getPropertyIds(organizationId);
    if (propertyIds.length === 0) continue;

    const arriving = await getArrivingReservations(propertyIds, today, tomorrow);

    for (const reservation of arriving) {
      if (!reservation.propertyId || !reservation.arrivalDate) continue;

      const firstName = reservation.guestFirstName ?? 'Guest';
      const propertyName = await getPropertyName(reservation.propertyId);
      const arrivalDate = new Date(reservation.arrivalDate);
      const arrivalDay9am = new Date(Date.UTC(
        arrivalDate.getUTCFullYear(), arrivalDate.getUTCMonth(), arrivalDate.getUTCDate(), 9,
      ));

      const toInsert = [
        {
          id: crypto.randomUUID(),
          organizationId,
          propertyId: reservation.propertyId,
          propertyName,
          reservationId: reservation.id,
          title: `Send welcome message to ${firstName}`,
          description: `Guest arriving ${arrivalDate.toDateString()}. Send a warm welcome before check-in.`,
          suggestedDueDate: arrivalDay9am,
          source: 'reservation',
          status: 'pending',
          createdAt: new Date(),
        },
      ];

      if (await getPropertyPool(reservation.propertyId)) {
        const dayBefore10am = new Date(Date.UTC(
          arrivalDate.getUTCFullYear(), arrivalDate.getUTCMonth(), arrivalDate.getUTCDate() - 1, 10,
        ));
        toInsert.push({
          id: crypto.randomUUID(),
          organizationId,
          propertyId: reservation.propertyId,
          propertyName,
          reservationId: reservation.id,
          title: `Start pool heating before ${firstName} arrival`,
          description: `Guest arrives ${arrivalDate.toDateString()}. Start heating in advance.`,
          suggestedDueDate: dayBefore10am,
          source: 'reservation',
          status: 'pending',
          createdAt: new Date(),
        });
      }

      for (const s of toInsert) {
        await insertSuggestion(s);
        inserted++;
      }
    }
  }

  return NextResponse.json({ ok: true, inserted });
}
