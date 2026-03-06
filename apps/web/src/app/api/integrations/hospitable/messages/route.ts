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

type ApiConfig = { apiKey: string; baseUrl: string };

function normalizeMessage(
  value: unknown,
  index: number,
  reservationId: string,
  guestName: string
): ProviderMessage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = String(record.id ?? `msg-${reservationId}-${index}`);
  const message = String(record.message ?? record.body ?? record.text ?? '');
  const sentAt = String(record.sentAt ?? record.sent_at ?? record.created_at ?? new Date().toISOString());

  if (!message) {
    return null;
  }

  return { id, reservationId, guestName, message, sentAt };
}

function extractList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data;
    if (Array.isArray(r.messages)) return r.messages;
  }
  return [];
}

async function fetchMessagesForReservation(
  config: ApiConfig,
  reservationId: string,
  guestName: string
): Promise<ProviderMessage[]> {
  const url = new URL(`/v2/reservations/${reservationId}/messages`, config.baseUrl);
  const response = await fetch(url, {
    headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
  });
  if (!response.ok) return [];

  const raw = (await response.json()) as unknown;
  return extractList(raw)
    .map((item, i) => normalizeMessage(item, i, reservationId, guestName))
    .filter((item): item is ProviderMessage => item !== null);
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

  const { reservationId, limit } = parsedQuery.data;

  // Single reservation — fetch messages directly
  if (reservationId) {
    const providerUrl = new URL(`/v2/reservations/${reservationId}/messages`, config.baseUrl);
    providerUrl.searchParams.set('limit', String(limit));

    const providerResponse = await fetch(providerUrl, {
      headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
    });

    if (!providerResponse.ok) {
      return NextResponse.json(
        { error: `Hospitable API request failed with ${providerResponse.status}.`, providerStatus: providerResponse.status },
        { status: 502 }
      );
    }

    const raw = (await providerResponse.json()) as unknown;
    const items = extractList(raw)
      .map((item, i) => normalizeMessage(item, i, reservationId, 'Guest'))
      .filter((item): item is ProviderMessage => item !== null);

    return NextResponse.json({ source: 'hospitable-api', count: items.length, items });
  }

  // No reservationId — fetch recent reservations, then fan out to messages per reservation
  const reservationsUrl = new URL('/v2/reservations', config.baseUrl);
  reservationsUrl.searchParams.set('limit', '20');

  const reservationsResponse = await fetch(reservationsUrl, {
    headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
  });

  if (!reservationsResponse.ok) {
    return NextResponse.json(
      {
        error: `Hospitable API request failed with ${reservationsResponse.status}.`,
        providerStatus: reservationsResponse.status
      },
      { status: 502 }
    );
  }

  const reservationsList = extractList((await reservationsResponse.json()) as unknown);

  const messageArrays = await Promise.all(
    reservationsList.map((res): Promise<ProviderMessage[]> => {
      if (!res || typeof res !== 'object') return Promise.resolve([]);
      const r = res as Record<string, unknown>;
      const resId = String(r.id ?? '');
      if (!resId) return Promise.resolve([]);
      const guest = r.guest as Record<string, unknown> | undefined;
      const guestName = String(r.guestName ?? r.guest_name ?? guest?.name ?? 'Guest');
      return fetchMessagesForReservation(config, resId, guestName);
    })
  );

  const allMessages = messageArrays
    .flat()
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, limit);

  return NextResponse.json({ source: 'hospitable-api', count: allMessages.length, items: allMessages });
}
