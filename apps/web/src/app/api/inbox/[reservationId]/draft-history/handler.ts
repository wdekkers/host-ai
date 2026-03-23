import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { draftEvents } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const handleDraftHistory = withPermission(
  'inbox.read',
  async (request: Request, _ctx: Params) => {
    try {
      const url = new URL(request.url);
      const messageId = url.searchParams.get('messageId');

      if (!messageId) {
        return NextResponse.json({ error: 'messageId query param is required' }, { status: 400 });
      }

      const rows = await db
        .select({
          action: draftEvents.action,
          actorId: draftEvents.actorId,
          beforePayload: draftEvents.beforePayload,
          afterPayload: draftEvents.afterPayload,
          metadata: draftEvents.metadata,
          createdAt: draftEvents.createdAt,
        })
        .from(draftEvents)
        .where(eq(draftEvents.messageId, messageId))
        .orderBy(asc(draftEvents.createdAt));

      return NextResponse.json({
        events: rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/draft-history' });
    }
  },
);
