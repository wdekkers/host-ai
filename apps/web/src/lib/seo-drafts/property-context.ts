import { asc } from 'drizzle-orm';
import { properties } from '@walt/db';

import { db } from '@/lib/db';

export type FriscoPropertyContext = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  summary: string;
};

export async function getFriscoPropertyContext(): Promise<FriscoPropertyContext[]> {
  const rows = await db
    .select({
      id: properties.id,
      name: properties.name,
      city: properties.city,
      address: properties.address,
      addressState: properties.addressState,
      description: properties.description,
      summary: properties.summary,
    })
    .from(properties)
    .orderBy(asc(properties.name));

  return rows
    .filter(
      (row) =>
        row.city?.toLowerCase().includes('frisco') ||
        row.address?.toLowerCase().includes('frisco') ||
        row.addressState?.toLowerCase() === 'tx',
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city ?? null,
      address: row.address ?? null,
      summary:
        row.description ??
        row.summary ??
        (row.address ? `${row.name} near ${row.address}` : row.name),
    }));
}
