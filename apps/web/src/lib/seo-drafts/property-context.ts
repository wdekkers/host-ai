import { asc } from 'drizzle-orm';
import { properties } from '@walt/db';

import { db } from '@/lib/db';

type RawProperty = Record<string, unknown> | null;

export type FriscoPropertyContext = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  summary: string;
};

function rawToSummary(raw: RawProperty, fallbackName: string, fallbackAddress: string | null): string {
  const description =
    typeof raw?.description === 'string'
      ? raw.description
      : typeof raw?.summary === 'string'
        ? raw.summary
        : null;

  if (description) {
    return description;
  }

  return fallbackAddress ? `${fallbackName} near ${fallbackAddress}` : fallbackName;
}

function isFriscoProperty(city: string | null, raw: RawProperty): boolean {
  if (city?.toLowerCase().includes('frisco')) {
    return true;
  }

  const address =
    typeof raw?.address === 'string'
      ? raw.address
      : typeof raw?.fullAddress === 'string'
        ? raw.fullAddress
        : null;

  return address?.toLowerCase().includes('frisco') ?? false;
}

export async function getFriscoPropertyContext(): Promise<FriscoPropertyContext[]> {
  const rows = await db
    .select({
      id: properties.id,
      name: properties.name,
      city: properties.city,
      address: properties.address,
      raw: properties.raw,
    })
    .from(properties)
    .orderBy(asc(properties.name));

  return rows
    .filter((row) => isFriscoProperty(row.city, row.raw as RawProperty))
    .map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city ?? null,
      address: row.address ?? null,
      summary: rawToSummary(row.raw as RawProperty, row.name, row.address ?? null),
    }));
}
