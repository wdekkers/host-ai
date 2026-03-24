import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize.js';
import { db } from '@/lib/db.js';
import { handleApiError } from '@/lib/secure-logger.js';
import { notifications } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

export const handleMarkRead = withPermission(
  'notifications.write',
  async (_request: Request, { params }: Params, authContext) => {
    try {
      const { id } = await params;

      const [existing] = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.organizationId, authContext.orgId)))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }

      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.id, id), eq(notifications.organizationId, authContext.orgId)));

      return new NextResponse(null, { status: 200 });
    } catch (error) {
      return handleApiError({ error, route: '/api/notifications/[id]/read PUT' });
    }
  },
);
