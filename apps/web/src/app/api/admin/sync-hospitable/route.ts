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

async function fetchAllReservations(config: { apiKey: string; baseUrl: string }) {
  const all: Record<string, unknown>[] = [];
  let url: string | null = new URL('/v2/reservations?limit=100&includes[]=guest&includes[]=properties', config.baseUrl).toString();

  while (url) {
    const res = await fetch(url, {
      headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
    });
    if (!res.ok) throw new Error(`Hospitable reservations returned ${res.status}`);
    const body = (await res.json()) as HospitableListResponse;
    all.push(...(body.data ?? []));
    url = body.links?.next ?? null;
  }

  return all;
}

async function fetchMessagesForReservation(config: { apiKey: string; baseUrl: string }, reservationId: string) {
  const url = new URL(`/v2/reservations/${reservationId}/messages?limit=100`, config.baseUrl);
  const res = await fetch(url, {
    headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: Record<string, unknown>[] };
  return body.data ?? [];
}

export async function POST() {
  const config = getHospitableApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'Hospitable API not configured.' },
      { status: 503 }
    );
  }

  const rawReservations = await fetchAllReservations(config);
  const now = new Date();
  let reservationCount = 0;
  let messageCount = 0;

  for (const raw of rawReservations) {
    const normalized = normalizeReservation(raw);
    await db
      .insert(reservations)
      .values({ ...normalized, syncedAt: now })
      .onConflictDoUpdate({
        target: reservations.id,
        set: { ...normalized, syncedAt: now }
      });
    reservationCount++;

    const rawMessages = await fetchMessagesForReservation(config, normalized.id);
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

  return NextResponse.json({ reservations: reservationCount, messages: messageCount });
}
