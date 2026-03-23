import { NextResponse } from 'next/server';
import { and, isNull, gt, eq } from 'drizzle-orm';
import { messages, reservations, properties, taskSuggestions, propertyAccess } from '@walt/db';
import type { MessageAnalysis } from '@/lib/ai/analyze-message';
import type { SuggestionResult } from '@/lib/generate-reply-suggestion';

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
  analyze?: (context: { body: string; guestFirstName: string; propertyName: string; arrivalDate: string }) => Promise<MessageAnalysis>;
  generateSuggestion?: (params: { guestFirstName: string | null; guestLastName: string | null; propertyName: string; propertyId: string | null; organizationId: string; checkIn: Date | string | null; checkOut: Date | string | null; conversationHistory: Array<{ body: string; senderType: string }> }) => Promise<SuggestionResult | null>;
  insertSuggestion?: (row: Record<string, unknown>) => Promise<void>;
  insertDraftEvent?: (row: Record<string, unknown>) => Promise<void>;
  updateMessageDraft?: (id: string, fields: Record<string, unknown>) => Promise<void>;
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

  const analyze = deps.analyze ?? (async (ctx) => {
    const { analyzeMessage } = await import('@/lib/ai/analyze-message');
    return analyzeMessage(ctx);
  });

  const generateSuggestion = deps.generateSuggestion ?? (async (params) => {
    const { generateReplySuggestion } = await import('@/lib/generate-reply-suggestion');
    return generateReplySuggestion(params);
  });

  const insertSuggestion = deps.insertSuggestion ?? (async (row: Record<string, unknown>) => {
    await db.insert(taskSuggestions).values(row as never).onConflictDoNothing();
  });

  const insertDraftEvent = deps.insertDraftEvent ?? (async (row: Record<string, unknown>) => {
    const { draftEvents } = await import('@walt/db');
    await db.insert(draftEvents).values(row as never);
  });

  const updateMessageDraft = deps.updateMessageDraft ?? (async (id: string, fields: Record<string, unknown>) => {
    await db.update(messages).set(fields as never).where(eq(messages.id, id));
  });

  const unscanned = await getUnscannedMessages();
  let inserted = 0;

  for (const message of unscanned) {
    await markScanned(message.id);
    if (!message.reservationId) continue;

    const ctx = await getReservationContext(message.reservationId);
    if (!ctx) continue;

    // Step 1: Analyze message (intent + escalation + task suggestion)
    const analysis = await analyze({
      body: message.body ?? '',
      guestFirstName: ctx.guestFirstName,
      propertyName: ctx.propertyName,
      arrivalDate: ctx.arrivalDate,
    });

    // Step 2: Generate AI draft
    const draft = await generateSuggestion({
      guestFirstName: ctx.guestFirstName,
      guestLastName: null,
      propertyName: ctx.propertyName,
      propertyId: ctx.propertyId,
      organizationId: ctx.organizationId,
      checkIn: null, // not available in cron context without full reservation query
      checkOut: null,
      conversationHistory: [{ body: message.body ?? '', senderType: 'guest' }],
    });

    // Step 3: Update message with draft + analysis metadata
    if (draft) {
      await updateMessageDraft(message.id, {
        suggestion: draft.suggestion,
        suggestionGeneratedAt: new Date(),
        draftStatus: 'pending_review',
        intent: analysis.intent,
        escalationLevel: analysis.escalationLevel,
        escalationReason: analysis.escalationReason,
        sourcesUsed: draft.sourcesUsed,
      });

      // Step 4: Insert draft event
      await insertDraftEvent({
        organizationId: ctx.organizationId,
        messageId: message.id,
        action: 'generated',
        afterPayload: draft.suggestion,
        metadata: {
          intent: analysis.intent,
          escalationLevel: analysis.escalationLevel,
          sourcesUsed: draft.sourcesUsed,
        },
      });
    }

    // Step 5: If task suggested, insert task suggestion (existing behavior)
    if (analysis.suggestedTask) {
      await insertSuggestion({
        id: crypto.randomUUID(),
        organizationId: ctx.organizationId,
        propertyId: ctx.propertyId,
        propertyName: ctx.propertyName,
        reservationId: ctx.reservationId,
        messageId: message.id,
        title: analysis.suggestedTask.title,
        description: analysis.suggestedTask.description,
        source: 'message',
        status: 'pending',
        createdAt: new Date(),
      });
      inserted++;
    }
  }

  return NextResponse.json({ ok: true, inserted });
}
