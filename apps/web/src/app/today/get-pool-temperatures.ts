import { sql } from 'drizzle-orm';

export type PoolTempRow = {
  propertyId: string;
  propertyName: string;
  pumpRunning: boolean;
  temperatureF: number | null;
  asOf: Date | null;
};

type RawPoll = {
  property_id: string;
  property_name: string;
  temperature_f: number | null;
  polled_at: Date;
};

type RawKnown = {
  property_id: string;
  temperature_f: number;
  polled_at: Date;
};

type Deps = {
  executeLatestPolls?: (orgId: string) => Promise<RawPoll[]>;
  executeLastKnown?: (orgId: string) => Promise<RawKnown[]>;
};

export async function getPoolTemperatures(orgId: string, deps: Deps = {}): Promise<PoolTempRow[]> {
  const { db } = await import('@/lib/db');

  const executeLatestPolls =
    deps.executeLatestPolls ??
    (async (id: string) => {
      const result = await db.execute(sql`
        SELECT DISTINCT ON (r.property_id)
          r.property_id,
          r.temperature_f,
          r.polled_at,
          p.name AS property_name
        FROM walt.pool_temperature_readings r
        JOIN walt.properties p ON p.id = r.property_id
        WHERE EXISTS (
          SELECT 1 FROM walt.property_access pa
          WHERE pa.property_id = r.property_id
            AND pa.organization_id = ${id}
        )
          AND p.iaqualink_device_serial IS NOT NULL
        ORDER BY r.property_id, r.polled_at DESC
      `);
      return result.rows as RawPoll[];
    });

  const executeLastKnown =
    deps.executeLastKnown ??
    (async (id: string) => {
      const result = await db.execute(sql`
        SELECT DISTINCT ON (r.property_id)
          r.property_id,
          r.temperature_f,
          r.polled_at
        FROM walt.pool_temperature_readings r
        WHERE EXISTS (
          SELECT 1 FROM walt.property_access pa
          WHERE pa.property_id = r.property_id
            AND pa.organization_id = ${id}
        )
          AND r.temperature_f IS NOT NULL
        ORDER BY r.property_id, r.polled_at DESC
      `);
      return result.rows as RawKnown[];
    });

  const latestPolls = await executeLatestPolls(orgId);
  const lastKnown = await executeLastKnown(orgId);

  const knownMap = new Map<string, RawKnown>();
  for (const row of lastKnown) {
    knownMap.set(row.property_id, row);
  }

  return latestPolls.map((poll) => {
    const known = knownMap.get(poll.property_id);
    return {
      propertyId: poll.property_id,
      propertyName: poll.property_name,
      pumpRunning: poll.temperature_f !== null,
      temperatureF: known?.temperature_f ?? null,
      asOf: known?.polled_at ?? null,
    };
  });
}
