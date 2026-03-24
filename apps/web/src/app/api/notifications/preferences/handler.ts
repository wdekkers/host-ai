import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize.js';
import { db } from '@/lib/db.js';
import { handleApiError } from '@/lib/secure-logger.js';
import { updateNotificationPreferencesInputSchema } from '@walt/contracts';
import { notificationPreferences } from '@walt/db';

export const handleGetPreferences = withPermission(
  'notifications.read',
  async (_request: Request, _context: unknown, authContext) => {
    try {
      const prefs = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.organizationId, authContext.orgId));

      return NextResponse.json(prefs);
    } catch (error) {
      return handleApiError({ error, route: '/api/notifications/preferences GET' });
    }
  },
);

export const handleUpdatePreferences = withPermission(
  'notifications.write',
  async (request: Request, _context: unknown, authContext) => {
    try {
      const body: unknown = await request.json();
      const parsed = updateNotificationPreferencesInputSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid request body', details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { category, channels, quietHours } = parsed.data;
      const memberId = authContext.userId;
      const now = new Date();

      const [updated] = await db
        .insert(notificationPreferences)
        .values({
          organizationId: authContext.orgId,
          memberId,
          category,
          channels,
          quietHours: quietHours ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            notificationPreferences.organizationId,
            notificationPreferences.memberId,
            notificationPreferences.category,
          ],
          set: {
            channels,
            quietHours: quietHours ?? null,
            updatedAt: now,
          },
        })
        .returning();

      return NextResponse.json(updated);
    } catch (error) {
      return handleApiError({ error, route: '/api/notifications/preferences PUT' });
    }
  },
);
