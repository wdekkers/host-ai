import { z } from 'zod';
import { NextResponse } from 'next/server';

import { getHospitableApiConfig } from '@/lib/integrations-env';

const querySchema = z.object({
  reservationId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

type ProviderMessage = {
  id: string;
  reservationId: string;
  guestName: string;
  message: string;
  sentAt: string;
};

function normalizeMessage(value: unknown, index: number): ProviderMessage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = String(record.id ?? `msg-${index}`);
  const reservationId = String(record.reservationId ?? record.reservation_id ?? '');
  const guestName = String(record.guestName ?? record.guest_name ?? 'Guest');
  const message = String(record.message ?? record.body ?? '');
  const sentAt = String(record.sentAt ?? record.sent_at ?? new Date().toISOString());

  if (reservationId.length === 0 || message.length === 0) {
    return null;
  }

  return { id, reservationId, guestName, message, sentAt };
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
    reservationId: url.searchParams.get('reservationId') ?? undefined,
    limit: url.searchParams.get('limit') ?? '25'
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.message }, { status: 400 });
  }

  const providerUrl = new URL('/v2/messages', config.baseUrl);
  providerUrl.searchParams.set('limit', String(parsedQuery.data.limit));
  if (parsedQuery.data.reservationId) {
    providerUrl.searchParams.set('reservationId', parsedQuery.data.reservationId);
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
    | { data?: unknown[]; messages?: unknown[] }
    | unknown[]
    | Record<string, unknown>;

  const candidates = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(rawPayload.data)
      ? rawPayload.data
      : Array.isArray(rawPayload.messages)
        ? rawPayload.messages
        : [];

  const items = candidates
    .map((item, index) => normalizeMessage(item, index))
    .filter((item): item is ProviderMessage => item !== null);

  return NextResponse.json({
    source: 'hospitable-api',
    count: items.length,
    items
  });
}
