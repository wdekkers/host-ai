import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { messages, draftEvents } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const handleReject = withPermission(
  'inbox.create',
  async (request: Request, { params }: Params, authContext) => {
    try {
      await params;
      const body = (await request.json()) as { messageId: string; reason?: string };
      const { messageId, reason } = body;

      if (!messageId) {
        return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
      }

      const [message] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.id, messageId));

      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      await db
        .update(messages)
        .set({ draftStatus: 'rejected' })
        .where(eq(messages.id, messageId));

      await db.insert(draftEvents).values({
        organizationId: authContext.orgId,
        messageId,
        action: 'rejected',
        actorId: authContext.userId,
        metadata: reason ? { reason } : null,
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/reject' });
    }
  },
);
