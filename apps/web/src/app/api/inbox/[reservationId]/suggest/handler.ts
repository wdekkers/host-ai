import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { analyzeMessage } from '@/lib/ai/analyze-message';
import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { generateReplySuggestion } from '@/lib/generate-reply-suggestion';
import { handleApiError } from '@/lib/secure-logger';
import { draftEvents, messages, reservations } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const handleSuggest = withPermission(
  'inbox.read',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { reservationId } = await params;
      const body = (await request.json()) as {
        messageId: string;
        chips?: string[];
        extraContext?: string;
      };
      const { messageId, chips, extraContext } = body;

      if (!messageId) {
        return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
      }

      const [reservation] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId));

      if (!reservation) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }

      const thread = await db
        .select({ id: messages.id, body: messages.body, senderType: messages.senderType })
        .from(messages)
        .where(eq(messages.reservationId, reservationId))
        .orderBy(asc(messages.createdAt));

      if (thread.length === 0) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      const organizationId = authContext.orgId;

      // Check if this is a regeneration (message already has a suggestion)
      const [existingMessage] = await db
        .select({ suggestion: messages.suggestion })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      const isRegeneration = Boolean(existingMessage?.suggestion);

      const result = await generateReplySuggestion({
        guestFirstName: reservation.guestFirstName ?? null,
        guestLastName: reservation.guestLastName ?? null,
        propertyName: reservation.propertyName ?? 'the property',
        propertyId: reservation.propertyId ?? null,
        organizationId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        conversationHistory: thread,
        chips,
        extraContext,
      });

      if (!result) {
        return NextResponse.json({ error: 'Could not generate suggestion' }, { status: 503 });
      }

      // Find the latest guest message for analysis
      const latestGuestMessage = [...thread].reverse().find((m) => m.senderType === 'guest');

      let intent: string | undefined;
      let escalationLevel: string | undefined;
      let escalationReason: string | null = null;

      if (latestGuestMessage) {
        const analysis = await analyzeMessage({
          body: latestGuestMessage.body,
          guestFirstName: reservation.guestFirstName ?? '',
          propertyName: reservation.propertyName ?? 'the property',
          arrivalDate: reservation.checkIn?.toISOString() ?? '',
        });
        intent = analysis.intent;
        escalationLevel = analysis.escalationLevel;
        escalationReason = analysis.escalationReason;
      }

      await db
        .update(messages)
        .set({
          draftStatus: 'pending_review',
          intent,
          escalationLevel,
          escalationReason,
          suggestion: result.suggestion,
          sourcesUsed: result.sourcesUsed,
          suggestionGeneratedAt: new Date(),
        })
        .where(eq(messages.id, messageId));

      await db.insert(draftEvents).values({
        organizationId,
        messageId,
        action: isRegeneration ? 'regenerated' : 'generated',
        actorId: authContext.userId,
        afterPayload: result.suggestion,
        metadata: {
          intent,
          escalationLevel,
          escalationReason,
          sourcesUsed: result.sourcesUsed,
          chips,
          extraContext,
        },
      });

      return NextResponse.json({
        suggestion: result.suggestion,
        sourcesUsed: result.sourcesUsed,
        intent,
        escalationLevel,
        escalationReason,
      });
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/suggest' });
    }
  },
);
