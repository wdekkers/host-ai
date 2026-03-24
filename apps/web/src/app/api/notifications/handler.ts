import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { notifications } from '@walt/db';

export const handleListNotifications = withPermission(
  'notifications.read',
  async (request: Request, _context: unknown, authContext) => {
    try {
      const url = new URL(request.url);
      const category = url.searchParams.get('category');

      const conditions = [eq(notifications.organizationId, authContext.orgId)];

      if (category) {
        conditions.push(eq(notifications.category, category));
      }

      const [items, unreadResult] = await Promise.all([
        db
          .select()
          .from(notifications)
          .where(and(...conditions))
          .orderBy(desc(notifications.createdAt))
          .limit(50),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(notifications)
          .where(
            and(
              eq(notifications.organizationId, authContext.orgId),
              isNull(notifications.readAt),
            ),
          ),
      ]);

      const unreadCount = unreadResult[0]?.count ?? 0;

      return NextResponse.json({ items, unreadCount });
    } catch (error) {
      return handleApiError({ error, route: '/api/notifications GET' });
    }
  },
);
