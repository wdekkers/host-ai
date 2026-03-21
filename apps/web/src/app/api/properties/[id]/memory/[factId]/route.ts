import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { propertyMemory } from '@walt/db';

type Params = { params: Promise<{ id: string; factId: string }> };

export const DELETE = withPermission(
  'properties.update',
  async (_req: Request, { params }: Params, authContext) => {
    try {
      const { id: propertyId, factId } = await params;
      const organizationId = authContext.orgId;

      await db
        .delete(propertyMemory)
        .where(
          and(
            eq(propertyMemory.id, factId),
            eq(propertyMemory.propertyId, propertyId),
            eq(propertyMemory.organizationId, organizationId),
          ),
        );

      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleApiError({ error, route: '/api/properties/[id]/memory/[factId] DELETE' });
    }
  },
);
