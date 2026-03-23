import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { sendViaHospitable } from '@/lib/hospitable/send-message';
import { handleApiError } from '@/lib/secure-logger';
import { reservations, messages, draftEvents } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const handleSend = withPermission(
  'inbox.create',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { reservationId } = await params;
      const { suggestion, messageId } = (await request.json()) as {
        suggestion: string;
        messageId?: string;
      };

      if (!suggestion?.trim()) {
        return NextResponse.json({ error: 'suggestion is required' }, { status: 400 });
      }

      const [reservation] = await db
        .select({
          id: reservations.id,
          conversationId: reservations.conversationId,
        })
        .from(reservations)
        .where(eq(reservations.id, reservationId));

      if (!reservation) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }

      const finalText = suggestion.trim();

      // --- Path A: AI-assisted reply (messageId provided) ---
      if (messageId) {
        const [originalMessage] = await db
          .select({
            id: messages.id,
            suggestion: messages.suggestion,
            draftStatus: messages.draftStatus,
          })
          .from(messages)
          .where(eq(messages.id, messageId));

        if (originalMessage) {
          const originalDraft = originalMessage.suggestion;
          const wasEdited = originalDraft != null && originalDraft !== finalText;

          if (wasEdited) {
            await db.insert(draftEvents).values({
              organizationId: authContext.orgId,
              messageId,
              action: 'edited',
              actorId: authContext.userId,
              beforePayload: originalDraft,
              afterPayload: finalText,
            });
          }

          await db.insert(draftEvents).values({
            organizationId: authContext.orgId,
            messageId,
            action: 'approved',
            actorId: authContext.userId,
            afterPayload: finalText,
          });
        }

        // Try sending via Hospitable
        if (reservation.conversationId) {
          const hospitable = await sendViaHospitable({
            conversationId: reservation.conversationId,
            body: finalText,
          });

          if (!hospitable.success) {
            return NextResponse.json(
              { error: `Failed to send via platform: ${hospitable.error}` },
              { status: 502 },
            );
          }

          if (originalMessage) {
            await db.insert(draftEvents).values({
              organizationId: authContext.orgId,
              messageId,
              action: 'sent',
              actorId: authContext.userId,
              metadata: { platformMessageId: hospitable.platformMessageId },
            });
          }
        }

        // Update draft status
        if (originalMessage) {
          await db
            .update(messages)
            .set({ draftStatus: 'sent' })
            .where(eq(messages.id, messageId));
        }
      } else {
        // --- Path B: Manual reply (no messageId) ---
        if (reservation.conversationId) {
          const hospitable = await sendViaHospitable({
            conversationId: reservation.conversationId,
            body: finalText,
          });

          if (!hospitable.success) {
            return NextResponse.json(
              { error: `Failed to send via platform: ${hospitable.error}` },
              { status: 502 },
            );
          }
        }
      }

      // Create host message record (both paths)
      await db.insert(messages).values({
        id: uuidv4(),
        reservationId,
        platform: null,
        body: finalText,
        senderType: 'host',
        senderFullName: null,
        createdAt: new Date(),
        suggestion: null,
        suggestionGeneratedAt: null,
        raw: {},
      });

      return NextResponse.json({ ok: true, body: finalText });
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/send' });
    }
  },
);
