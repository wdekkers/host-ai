import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { conversationSettings } from '@walt/db';
import { updateAiStatusInputSchema } from '@walt/contracts';

type Params = { params: Promise<{ reservationId: string }> };

export const handleUpdateAiStatus = withPermission(
  'conversations.write',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { reservationId } = await params;

      const body: unknown = await request.json();
      const parsed = updateAiStatusInputSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid request body', details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { status, pauseDurationMinutes } = parsed.data;
      const now = new Date();

      let aiPausedUntil: Date | null = null;
      if (status === 'paused' && pauseDurationMinutes) {
        aiPausedUntil = new Date(Date.now() + pauseDurationMinutes * 60 * 1000);
      }

      const [updated] = await db
        .insert(conversationSettings)
        .values({
          reservationId,
          organizationId: authContext.orgId,
          aiStatus: status,
          aiPausedUntil,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: conversationSettings.reservationId,
          set: {
            aiStatus: status,
            aiPausedUntil,
            updatedAt: now,
            organizationId: authContext.orgId,
          },
        })
        .returning();

      return NextResponse.json(updated);
    } catch (error) {
      return handleApiError({
        error,
        route: '/api/conversations/[reservationId]/ai-status PUT',
      });
    }
  },
);
