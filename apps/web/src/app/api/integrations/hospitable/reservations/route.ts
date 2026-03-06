import { z } from 'zod';
import { NextResponse } from 'next/server';

import { getHospitableApiConfig } from '@/lib/integrations-env';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().optional()
});

type Reservation = {
  id: string;
  propertyId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  createdAt: string;
};

function normalizeReservation(value: unknown, index: number): Reservation | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = String(record.id ?? `res-${index}`);
  const propertyId = String(record.propertyId ?? record.property_id ?? record.listing_id ?? '');
  const guest = record.guest as Record<string, unknown> | undefined;
  const guestName = String(record.guestName ?? record.guest_name ?? guest?.name ?? 'Guest');
  const checkIn = String(record.checkIn ?? record.check_in ?? record.start_date ?? '');
  const checkOut = String(record.checkOut ?? record.check_out ?? record.end_date ?? '');
  const status = String(record.status ?? 'unknown');
  const createdAt = String(record.createdAt ?? record.created_at ?? new Date().toISOString());

  if (!checkIn || !checkOut) {
    return null;
  }

  return { id, propertyId, guestName, checkIn, checkOut, status, createdAt };
}

export async function GET(request: Request) {
  const config = getHospitableApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'Hospitable outbound API is not configured. Set HOSPITABLE_API_KEY and HOSPITABLE_BASE_URL.' },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    limit: url.searchParams.get('limit') ?? '25',
    status: url.searchParams.get('status') ?? undefined
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.message }, { status: 400 });
  }

  const providerUrl = new URL('/v2/reservations', config.baseUrl);
  providerUrl.searchParams.set('limit', String(parsedQuery.data.limit));
  if (parsedQuery.data.status) {
    providerUrl.searchParams.set('status', parsedQuery.data.status);
  }

  const providerResponse = await fetch(providerUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${config.apiKey}`
    }
  });

  if (!providerResponse.ok) {
    return NextResponse.json(
      {
        error: `Hospitable API request failed with ${providerResponse.status}.`,
        providerStatus: providerResponse.status
      },
      { status: 502 }
    );
  }

  const rawPayload = (await providerResponse.json()) as
    | { data?: unknown[]; reservations?: unknown[] }
    | unknown[]
    | Record<string, unknown>;

  const candidates = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray((rawPayload as { data?: unknown[] }).data)
      ? (rawPayload as { data: unknown[] }).data
      : Array.isArray((rawPayload as { reservations?: unknown[] }).reservations)
        ? (rawPayload as { reservations: unknown[] }).reservations
        : [];

  const items = candidates
    .map((item, index) => normalizeReservation(item, index))
    .filter((item): item is Reservation => item !== null);

  return NextResponse.json({
    source: 'hospitable-api',
    count: items.length,
    items
  });
}
