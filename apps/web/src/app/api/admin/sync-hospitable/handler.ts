import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { properties, reservations, messages } from '@walt/db';
import { db } from '@/lib/db';
import { getHospitableApiConfig } from '@/lib/integrations-env';
import {
  normalizeReservation,
  normalizeMessage,
  normalizeProperty,
} from '@/lib/hospitable-normalize';

const CORE_STATUSES = ['inquiry', 'pending', 'confirmed', 'cancelled'] as const;

const STATUS_MESSAGES: Record<string, string> = {
  inquiry: 'Guest sent an inquiry',
  pending: 'New booking request received',
  confirmed: 'Reservation confirmed',
  cancelled: 'Reservation cancelled',
};

type HospitableListResponse = {
  data: Record<string, unknown>[];
  links?: { next?: string | null };
  meta?: { current_page?: number; last_page?: number; total?: number; from?: number; to?: number };
};

function headers(apiKey: string) {
  return { accept: 'application/json', authorization: `Bearer ${apiKey}` };
}

async function fetchAllProperties(config: { apiKey: string; baseUrl: string }) {
  const all: Record<string, unknown>[] = [];
  let page = 1;

  while (true) {
    const url = new URL('/v2/properties', config.baseUrl);
    url.searchParams.set('per_page', '50');
    url.searchParams.set('page', String(page));
    const res = await fetch(url, { headers: headers(config.apiKey) });
    if (!res.ok) throw new Error(`Hospitable properties returned ${res.status}`);
    const body = (await res.json()) as HospitableListResponse;
    for (const p of body.data ?? []) {
      all.push(p);
    }
    const lastPage = body.meta?.last_page ?? 1;
    if (page >= lastPage) break;
    page++;
  }

  return all;
}

type ReservationFetchResult = {
  reservations: Record<string, unknown>[];
  pages: number;
  apiTotal: number | null;
};

async function fetchReservationsForProperty(
  config: { apiKey: string; baseUrl: string },
  propertyId: string,
): Promise<ReservationFetchResult> {
  const all: Record<string, unknown>[] = [];
  let pages = 0;
  let apiTotal: number | null = null;

  // Hospitable uses page-based pagination with meta.current_page / meta.last_page.
  // per_page is the correct parameter (not limit).
  // Use start_date/end_date (not starts_at[gte/lte]) with a bounded window to avoid 400.
  const from = '2024-01-01';
  const to = '2026-12-31';
  let page = 1;

  while (true) {
    const url = new URL('/v2/reservations', config.baseUrl);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    url.searchParams.append('properties[]', propertyId);
    url.searchParams.set('start_date', from);
    url.searchParams.set('end_date', to);

    const res = await fetch(url, { headers: headers(config.apiKey) });
    if (!res.ok) throw new Error(`Hospitable reservations returned ${res.status}`);
    const body = (await res.json()) as HospitableListResponse;
    const batch = body.data ?? [];
    all.push(...batch);
    pages++;

    if (apiTotal === null && body.meta?.total != null) {
      apiTotal = body.meta.total;
    }

    const lastPage = body.meta?.last_page ?? 1;
    if (page >= lastPage) break;
    page++;
  }

  return { reservations: all, pages, apiTotal };
}

async function fetchMessagesForReservation(
  config: { apiKey: string; baseUrl: string },
  reservationId: string,
): Promise<Record<string, unknown>[]> {
  const url = new URL(`/v2/reservations/${reservationId}/messages`, config.baseUrl);
  url.searchParams.set('per_page', '100');
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

export async function syncHospitable() {
  const config = getHospitableApiConfig();
  if (!config) {
    return { error: 'Hospitable API not configured.' };
  }

  const rawProperties = await fetchAllProperties(config);
  const now = new Date();
  let propertyCount = 0;
  let reservationCount = 0;
  let messageCount = 0;
  const propertyDetails: {
    id: string;
    name: string;
    reservationsFetched: number;
    pages: number;
    apiTotal: number | null;
  }[] = [];

  for (const rawProp of rawProperties) {
    const normalizedProp = normalizeProperty(rawProp);

    // Upsert property
    await db
      .insert(properties)
      .values({ ...normalizedProp, syncedAt: now })
      .onConflictDoUpdate({
        target: properties.id,
        set: { ...normalizedProp, syncedAt: now },
      });
    propertyCount++;

    const {
      reservations: rawReservations,
      pages,
      apiTotal,
    } = await fetchReservationsForProperty(config, normalizedProp.id);
    propertyDetails.push({
      id: normalizedProp.id,
      name: normalizedProp.name,
      reservationsFetched: rawReservations.length,
      pages,
      apiTotal,
    });

    for (const raw of rawReservations) {
      const rawMessages = await fetchMessagesForReservation(config, String(raw.id));
      const guest = extractGuestFromMessages(rawMessages);

      // Inject property and guest info in the shape normalizeReservation expects
      const enriched: Record<string, unknown> = {
        ...raw,
        properties: [{ id: normalizedProp.id, name: normalizedProp.name }],
        guest: { ...guest, id: null, email: null },
      };

      const normalized = normalizeReservation(enriched);

      // --- BEFORE the reservation upsert: fetch old status ---
      const newStatus = normalized.status;
      let oldStatus: string | null = null;

      const [existing] = await db
        .select({ status: reservations.status })
        .from(reservations)
        .where(eq(reservations.id, normalized.id))
        .limit(1);

      if (existing) {
        oldStatus = existing.status;
      }

      // --- Reservation upsert ---
      await db
        .insert(reservations)
        .values({ ...normalized, syncedAt: now })
        .onConflictDoUpdate({
          target: reservations.id,
          set: { ...normalized, syncedAt: now },
        });
      reservationCount++;

      // --- AFTER the reservation upsert: insert system message if status changed ---
      if (
        newStatus &&
        CORE_STATUSES.includes(newStatus as (typeof CORE_STATUSES)[number]) &&
        newStatus !== oldStatus
      ) {
        // Use Hospitable's updated_at timestamp when available, fall back to now()
        const statusChangedAt = raw.updated_at
          ? new Date(String(raw.updated_at))
          : new Date();

        await db
          .insert(messages)
          .values({
            id: uuidv4(),
            reservationId: normalized.id,
            platform: normalized.platform ?? null,
            body: STATUS_MESSAGES[newStatus] ?? `Reservation status: ${newStatus}`,
            senderType: 'system',
            senderFullName: null,
            createdAt: statusChangedAt,
            raw: { type: 'status_change', fromStatus: oldStatus, toStatus: newStatus },
            suggestionScannedAt: new Date(), // skip AI suggestion scanner
          })
          .onConflictDoNothing();
      }

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

  return {
    properties: propertyCount,
    reservations: reservationCount,
    messages: messageCount,
    debug: propertyDetails,
  };
}
