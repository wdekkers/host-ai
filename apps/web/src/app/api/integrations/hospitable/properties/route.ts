import { z } from 'zod';
import { NextResponse } from 'next/server';

import { getHospitableApiConfig } from '@/lib/integrations-env';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

type Property = {
  id: string;
  name: string;
  address: string;
  city: string;
  status: string;
};

function normalizeProperty(value: unknown, index: number): Property | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = String(record.id ?? `prop-${index}`);
  const name = String(record.name ?? record.title ?? record.listing_name ?? 'Unnamed Property');
  const address = String(record.address ?? record.street ?? '');
  const location = record.location as Record<string, unknown> | undefined;
  const city = String(record.city ?? location?.city ?? '');
  const status = String(record.status ?? 'active');

  if (!name) {
    return null;
  }

  return { id, name, address, city, status };
}

export async function GET(request: Request) {
  const config = getHospitableApiConfig();
  if (!config) {
    return NextResponse.json(
      {
        error:
          'Hospitable outbound API is not configured. Set HOSPITABLE_API_KEY and HOSPITABLE_BASE_URL.',
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    limit: url.searchParams.get('limit') ?? '50',
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.message }, { status: 400 });
  }

  const providerUrl = new URL('/v1/properties', config.baseUrl);
  providerUrl.searchParams.set('limit', String(parsedQuery.data.limit));

  const providerResponse = await fetch(providerUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!providerResponse.ok) {
    return NextResponse.json(
      {
        error: `Hospitable API request failed with ${providerResponse.status}.`,
        providerStatus: providerResponse.status,
      },
      { status: 502 },
    );
  }

  const rawPayload = (await providerResponse.json()) as
    | { data?: unknown[]; properties?: unknown[] }
    | unknown[]
    | Record<string, unknown>;

  const candidates = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray((rawPayload as { data?: unknown[] }).data)
      ? (rawPayload as { data: unknown[] }).data
      : Array.isArray((rawPayload as { properties?: unknown[] }).properties)
        ? (rawPayload as { properties: unknown[] }).properties
        : [];

  const items = candidates
    .map((item, index) => normalizeProperty(item, index))
    .filter((item): item is Property => item !== null);

  return NextResponse.json({
    source: 'hospitable-api',
    count: items.length,
    items,
  });
}
