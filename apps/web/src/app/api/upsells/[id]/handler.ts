import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { updateUpsellInputSchema } from '@walt/contracts';
import { upsellEvents } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

const updateUpsellBodySchema = updateUpsellInputSchema.omit({ upsellId: true }).extend({
  actualRevenue: z.number().int().nonnegative().optional(),
});

export const handleUpdateUpsell = withPermission(
  'upsells.write',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { id } = await params;

      const body = await request.json().catch(() => ({}));
      const parsed = updateUpsellBodySchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
      }

      const [existing] = await db
        .select()
        .from(upsellEvents)
        .where(and(eq(upsellEvents.id, id), eq(upsellEvents.organizationId, authContext.orgId)))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: 'Upsell not found' }, { status: 404 });
      }

      const now = new Date();
      const [updated] = await db
        .update(upsellEvents)
        .set({
          status: parsed.data.status,
          actualRevenue: parsed.data.actualRevenue ?? existing.actualRevenue,
          respondedAt: now,
        })
        .where(and(eq(upsellEvents.id, id), eq(upsellEvents.organizationId, authContext.orgId)))
        .returning();

      return NextResponse.json(updated);
    } catch (error) {
      return handleApiError({ error, route: '/api/upsells/[id] PUT' });
    }
  },
);
