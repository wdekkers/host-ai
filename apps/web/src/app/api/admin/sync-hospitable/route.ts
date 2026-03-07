import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { properties, reservations, messages } from '@walt/db';
import { db } from '@/lib/db';
import { getHospitableApiConfig } from '@/lib/integrations-env';
import { normalizeReservation, normalizeMessage } from '@/lib/hospitable-normalize';

type HospitableListResponse = {
  data: Record<string, unknown>[];
  links?: { next?: string | null };
};

function headers(apiKey: string) {
  return { accept: 'application/json', authorization: `Bearer ${apiKey}` };
}

async function fetchAllProperties(config: { apiKey: string; baseUrl: string }) {
  const all: Record<string, unknown>[] = [];
  let url: string | null = new URL('/v2/properties?limit=50', config.baseUrl).toString();

  while (url) {
    const res = await fetch(url, { headers: headers(config.apiKey) });
    if (!res.ok) throw new Error(`Hospitable properties returned ${res.status}`);
    const body = (await res.json()) as HospitableListResponse;
    for (const p of body.data ?? []) {
      all.push(p);
    }
    url = body.links?.next ?? null;
  }

  return all;
}

async function fetchReservationsForProperty(
  config: { apiKey: string; baseUrl: string },
  propertyId: string
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  // Use links.next for cursor-based pagination. Hospitable may return http:// in next links
  // and sometimes drops the properties[] filter — we fix both on each iteration.
  let url: string | null = `${config.baseUrl}/v2/reservations?limit=100&properties[]=${encodeURIComponent(propertyId)}`;

  while (url) {
    const res = await fetch(url, { headers: headers(config.apiKey) });
    if (!res.ok) throw new Error(`Hospitable reservations returned ${res.status}`);
    const body = (await res.json()) as HospitableListResponse;
    const batch = body.data ?? [];
    all.push(...batch);

    const rawNext = body.links?.next ?? null;
    if (!rawNext) break;

    // Fix http → https and re-inject property filter if Hospitable stripped it
    const nextUrl = new URL(rawNext.replace(/^http:\/\//i, 'https://'));
    if (!nextUrl.searchParams.has('properties[]')) {
      nextUrl.searchParams.set('properties[]', propertyId);
    }
    url = nextUrl.toString();
  }

  return all;
}

async function fetchMessagesForReservation(
  config: { apiKey: string; baseUrl: string },
  reservationId: string
): Promise<Record<string, unknown>[]> {
  const url = new URL(`/v2/reservations/${reservationId}/messages?limit=100`, config.baseUrl);
  const res = await fetch(url, { headers: headers(config.apiKey) });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: Record<string, unknown>[] };
  return body.data ?? [];
}

function extractGuestFromMessages(rawMessages: Record<string, unknown>[]) {
  const guestMsg = rawMessages.find((m) => m.sender_type === 'guest');
  if (!guestMsg) return { first_name: null, last_name: null };
  const sender = (guestMsg.sender ?? {}) as Record<string, unknown>;
  const fullName = String(sender.full_name ?? '').trim();
  if (!fullName) return { first_name: null, last_name: null };
  const [first, ...rest] = fullName.split(' ');
  return { first_name: first ?? null, last_name: rest.length > 0 ? rest.join(' ') : null };
}

function normalizeProperty(raw: Record<string, unknown>) {
  // v2 API returns a nested address object: { street, city, state, country, ... }
  const addr = (raw.address ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.public_name ?? ''),
    address: String(addr.street ?? addr.display ?? ''),
    city: String(addr.city ?? ''),
    status: raw.listed === false ? 'inactive' : 'active',
    raw: raw as Record<string, unknown>,
  };
}

export async function POST() {
  const config = getHospitableApiConfig();
  if (!config) {
    return NextResponse.json({ error: 'Hospitable API not configured.' }, { status: 503 });
  }

  const rawProperties = await fetchAllProperties(config);
  const now = new Date();
  let propertyCount = 0;
  let reservationCount = 0;
  let messageCount = 0;

  for (const rawProp of rawProperties) {
    const normalizedProp = normalizeProperty(rawProp);

    // Upsert property
    await db
      .insert(properties)
      .values({ ...normalizedProp, syncedAt: now })
      .onConflictDoUpdate({
        target: properties.id,
        set: { ...normalizedProp, syncedAt: now }
      });
    propertyCount++;

    const rawReservations = await fetchReservationsForProperty(config, normalizedProp.id);

    for (const raw of rawReservations) {
      const rawMessages = await fetchMessagesForReservation(config, String(raw.id));
      const guest = extractGuestFromMessages(rawMessages);

      // Inject property and guest info in the shape normalizeReservation expects
      const enriched: Record<string, unknown> = {
        ...raw,
        properties: [{ id: normalizedProp.id, name: normalizedProp.name }],
        guest: { ...guest, id: null, email: null }
      };

      const normalized = normalizeReservation(enriched);
      await db
        .insert(reservations)
        .values({ ...normalized, syncedAt: now })
        .onConflictDoUpdate({
          target: reservations.id,
          set: { ...normalized, syncedAt: now }
        });
      reservationCount++;

      for (const msg of rawMessages) {
        const normalizedMsg = normalizeMessage(msg, normalized.id);
        if (!normalizedMsg) continue;
        await db
          .insert(messages)
          .values({ id: uuidv4(), ...normalizedMsg })
          .onConflictDoNothing();
        messageCount++;
      }
    }
  }

  return NextResponse.json({ properties: propertyCount, reservations: reservationCount, messages: messageCount });
}
