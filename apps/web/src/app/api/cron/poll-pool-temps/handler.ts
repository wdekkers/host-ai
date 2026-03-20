import { NextResponse } from 'next/server';
import { isNotNull } from 'drizzle-orm';
import { properties, poolTemperatureReadings } from '@walt/db';
import type { PoolReading } from '@/lib/iaqualink';

type PooledProperty = {
  id: string;
  name: string;
  iaqualinkDeviceSerial: string;
};

type Deps = {
  cronSecret?: string;
  getPoolProperties?: () => Promise<PooledProperty[]>;
  readTemperature?: (serial: string) => Promise<PoolReading>;
  insertReading?: (row: {
    id: string;
    propertyId: string;
    deviceSerial: string;
    temperatureF: number | null;
    polledAt: Date;
  }) => Promise<void>;
};

export async function handlePollPoolTemps(request: Request, deps: Deps = {}) {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');

  const getPoolProperties =
    deps.getPoolProperties ??
    (async () => {
      const rows = await db
        .select({
          id: properties.id,
          name: properties.name,
          iaqualinkDeviceSerial: properties.iaqualinkDeviceSerial,
        })
        .from(properties)
        .where(isNotNull(properties.iaqualinkDeviceSerial));
      return rows as PooledProperty[];
    });

  const readTemperature =
    deps.readTemperature ??
    (async (serial: string) => {
      const { readTemperature: iaqRead } = await import('@/lib/iaqualink');
      return iaqRead(serial);
    });

  const insertReading =
    deps.insertReading ??
    (async (row) => {
      await db.insert(poolTemperatureReadings).values(row);
    });

  const poolProperties = await getPoolProperties();
  let polled = 0;

  for (const prop of poolProperties) {
    try {
      const reading = await readTemperature(prop.iaqualinkDeviceSerial);
      await insertReading({
        id: crypto.randomUUID(),
        propertyId: prop.id,
        deviceSerial: reading.deviceSerial,
        temperatureF: reading.temperatureF,
        polledAt: reading.polledAt,
      });
      console.log(
        `[poll-pool-temps] ${prop.name}: ${reading.temperatureF !== null ? `${reading.temperatureF}°F` : 'pump off'}`,
      );
      polled++;
    } catch (err) {
      console.error(`[poll-pool-temps] Error for ${prop.name} (${prop.iaqualinkDeviceSerial}):`, err);
    }
  }

  return NextResponse.json({ ok: true, polled });
}
