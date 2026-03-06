import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { reservations, messages } from '@walt/db';
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
  const all: Array<{ id: string; name: string }> = [];
  let url: string | null = new URL('/v2/properties?limit=50', config.baseUrl).toString();

  while (url) {
    const res = await fetch(url, { headers: headers(config.apiKey) });
    if (!res.ok) throw new Error(`Hospitable properties returned ${res.status}`);
    const body = (await res.json()) as HospitableListResponse;
    for (const p of body.data ?? []) {
      all.push({ id: String(p.id), name: String(p.name ?? '') });
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
  let page = 1;

  while (true) {
    // Build URL manually — links.next from Hospitable drops the properties[] filter
    // and uses http:// instead of https://, so we manage pagination ourselves.
    const url = `${config.baseUrl}/v2/reservations?limit=100&properties[]=${encodeURIComponent(propertyId)}&page=${page}`;
    const res = await fetch(url, { headers: headers(config.apiKey) });
    if (!res.ok) throw new Error(`Hospitable reservations returned ${res.status}`);
    const body = (await res.json()) as HospitableListResponse;
    const batch = body.data ?? [];
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
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

export async function POST() {
  const config = getHospitableApiConfig();
  if (!config) {
    return NextResponse.json({ error: 'Hospitable API not configured.' }, { status: 503 });
  }

  const properties = await fetchAllProperties(config);
  const now = new Date();
  let reservationCount = 0;
  let messageCount = 0;

  for (const property of properties) {
    const rawReservations = await fetchReservationsForProperty(config, property.id);

    for (const raw of rawReservations) {
      const rawMessages = await fetchMessagesForReservation(config, String(raw.id));
      const guest = extractGuestFromMessages(rawMessages);

      // Inject property and guest info in the shape normalizeReservation expects
      const enriched: Record<string, unknown> = {
        ...raw,
        properties: [{ id: property.id, name: property.name }],
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

  return NextResponse.json({ reservations: reservationCount, messages: messageCount });
}
