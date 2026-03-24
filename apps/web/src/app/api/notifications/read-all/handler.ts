import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize.js';
import { db } from '@/lib/db.js';
import { handleApiError } from '@/lib/secure-logger.js';
import { notifications } from '@walt/db';

export const handleMarkAllRead = withPermission(
  'notifications.write',
  async (_request: Request, _context: unknown, authContext) => {
    try {
      const now = new Date();

      const updated = await db
        .update(notifications)
        .set({ readAt: now })
        .where(
          and(
            eq(notifications.organizationId, authContext.orgId),
            isNull(notifications.readAt),
          ),
        )
        .returning({ id: notifications.id });

      return NextResponse.json({ ok: true, updated: updated.length });
    } catch (error) {
      return handleApiError({ error, route: '/api/notifications/read-all PUT' });
    }
  },
);
