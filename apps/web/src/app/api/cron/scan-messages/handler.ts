import { NextResponse } from 'next/server';
import { and, isNull, gt, eq } from 'drizzle-orm';
import { messages, reservations, properties, taskSuggestions, propertyAccess } from '@walt/db';
import type { SuggestedTask } from '@/lib/ai/classify-message';

type ReservationContext = {
  reservationId: string;
  propertyId: string;
  propertyName: string;
  guestFirstName: string;
  arrivalDate: string;
  organizationId: string;
};

type Deps = {
  cronSecret?: string;
  getUnscannedMessages?: () => Promise<Array<{ id: string; reservationId: string | null; body: string | null; senderType: string | null }>>;
  markScanned?: (id: string) => Promise<void>;
  getReservationContext?: (reservationId: string) => Promise<ReservationContext | null>;
  classify?: (context: { body: string; guestFirstName: string; propertyName: string; arrivalDate: string }) => Promise<SuggestedTask | null>;
  insertSuggestion?: (row: Record<string, unknown>) => Promise<void>;
};

export async function handleScanMessages(request: Request, deps: Deps = {}) {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const getUnscannedMessages = deps.getUnscannedMessages ?? (async () =>
    db.select().from(messages).where(
      and(isNull(messages.suggestionScannedAt), gt(messages.createdAt, twoHoursAgo), eq(messages.senderType, 'guest')),
    ).limit(100)
  );

  const markScanned = deps.markScanned ?? (async (id: string) => {
    await db.update(messages).set({ suggestionScannedAt: new Date() }).where(eq(messages.id, id));
  });

  const getReservationContext = deps.getReservationContext ?? (async (reservationId: string) => {
    const [res] = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1);
    if (!res?.propertyId || !res.arrivalDate) return null;
    const [prop] = await db.select({ name: properties.name }).from(properties).where(eq(properties.id, res.propertyId)).limit(1);
    const [access] = await db.select({ organizationId: propertyAccess.organizationId }).from(propertyAccess).where(eq(propertyAccess.propertyId, res.propertyId)).limit(1);
    if (!access) return null;
    return {
      reservationId,
      propertyId: res.propertyId,
      propertyName: prop?.name ?? res.propertyId,
      guestFirstName: res.guestFirstName ?? 'Guest',
      arrivalDate: res.arrivalDate.toISOString().slice(0, 10),
      organizationId: access.organizationId,
    };
  });

  const classify = deps.classify ?? (async (ctx) => {
    const { classifyMessage } = await import('@/lib/ai/classify-message');
    return classifyMessage(ctx);
  });

  const insertSuggestion = deps.insertSuggestion ?? (async (row: Record<string, unknown>) => {
    await db.insert(taskSuggestions).values(row as never).onConflictDoNothing();
  });

  const unscanned = await getUnscannedMessages();
  let inserted = 0;

  for (const message of unscanned) {
    await markScanned(message.id);
    if (!message.reservationId) continue;

    const ctx = await getReservationContext(message.reservationId);
    if (!ctx) continue;

    const suggestion = await classify({
      body: message.body ?? '',
      guestFirstName: ctx.guestFirstName,
      propertyName: ctx.propertyName,
      arrivalDate: ctx.arrivalDate,
    });

    if (!suggestion) continue;

    await insertSuggestion({
      id: crypto.randomUUID(),
      organizationId: ctx.organizationId,
      propertyId: ctx.propertyId,
      propertyName: ctx.propertyName,
      reservationId: ctx.reservationId,
      messageId: message.id,
      title: suggestion.title,
      description: suggestion.description,
      source: 'message',
      status: 'pending',
      createdAt: new Date(),
    });
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted });
}
