import { asc, count, eq, sql } from 'drizzle-orm';
import { properties, reservations, propertyAccess } from '@walt/db';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { PropertiesClient } from './PropertiesClient';

export default async function PropertiesPage() {
  const auth = await getAuthContext();
  if (!auth) return null;

  const [props, reservationCounts] = await Promise.all([
    db
      .select({
        id: properties.id,
        name: properties.name,
        address: properties.address,
        city: properties.city,
        status: properties.status,
        isActive: properties.isActive,
        hasPool: properties.hasPool,
      })
      .from(properties)
      .innerJoin(propertyAccess, sql`${propertyAccess.propertyId} = ${properties.id}`)
      .where(eq(propertyAccess.organizationId, auth.orgId))
      .orderBy(asc(properties.name)),
    db
      .select({ propertyId: reservations.propertyId, total: count() })
      .from(reservations)
      .groupBy(reservations.propertyId),
  ]);

  const countMap = Object.fromEntries(
    reservationCounts.map((r) => [r.propertyId, r.total]),
  );

  return <PropertiesClient properties={props} reservationCounts={countMap} />;
}
