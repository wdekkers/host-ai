import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { properties, poolTemperatureReadings } from '@walt/db';

type Deps = {
  webhookSecret?: string;
  getProperty?: (propertyId: string) => Promise<{ id: string; iaqualinkDeviceSerial: string | null } | null>;
  insertReading?: (row: {
    propertyId: string;
    deviceSerial: string;
    temperatureF: number | null;
    polledAt: Date;
  }) => Promise<void>;
};

export async function handleIftttPoolTemp(request: Request, deps: Deps = {}) {
  const secret = deps.webhookSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('propertyId');
  if (!propertyId) {
    return NextResponse.json({ error: 'Missing propertyId query param' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // IFTTT Webhooks action sends values as strings in value1/value2/value3.
  // Configure your IFTTT applet to put the temperature (°F) in value1.
  const rawTemp = body.value1;
  const parsed = typeof rawTemp === 'string' ? parseFloat(rawTemp) : typeof rawTemp === 'number' ? rawTemp : NaN;
  const temperatureF = isNaN(parsed) ? null : Math.round(parsed);

  const { db } = await import('@/lib/db');

  const getProperty =
    deps.getProperty ??
    (async (id: string) => {
      const rows = await db
        .select({ id: properties.id, iaqualinkDeviceSerial: properties.iaqualinkDeviceSerial })
        .from(properties)
        .where(eq(properties.id, id))
        .limit(1);
      return rows[0] ?? null;
    });

  const property = await getProperty(propertyId);
  if (!property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  }
  if (!property.iaqualinkDeviceSerial) {
    return NextResponse.json({ error: 'Property has no iAqualink device serial' }, { status: 400 });
  }

  const insertReading =
    deps.insertReading ??
    (async (row) => {
      await db.insert(poolTemperatureReadings).values(row);
    });

  await insertReading({
    propertyId: property.id,
    deviceSerial: property.iaqualinkDeviceSerial,
    temperatureF,
    polledAt: new Date(),
  });

  console.log(
    `[webhook/iaqualink] property ${propertyId}: ${temperatureF !== null ? `${temperatureF}°F` : 'temp unavailable'}`,
  );

  return NextResponse.json({ ok: true, temperatureF });
}
