import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { propertyMemory } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

export const GET = withPermission(
  'dashboard.read',
  async (_req: Request, { params }: Params, authContext) => {
    try {
      const { id: propertyId } = await params;
      const organizationId = authContext.orgId;

      const facts = await db
        .select()
        .from(propertyMemory)
        .where(
          and(
            eq(propertyMemory.organizationId, organizationId),
            eq(propertyMemory.propertyId, propertyId),
          ),
        )
        .orderBy(desc(propertyMemory.createdAt));

      return NextResponse.json({ facts });
    } catch (error) {
      return handleApiError({ error, route: '/api/properties/[id]/memory GET' });
    }
  },
);

export const POST = withPermission(
  'dashboard.read',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { id: propertyId } = await params;
      const organizationId = authContext.orgId;
      const { fact, source, sourceReservationId } = (await request.json()) as {
        fact: string;
        source?: string;
        sourceReservationId?: string;
      };

      if (!fact?.trim()) {
        return NextResponse.json({ error: 'fact is required' }, { status: 400 });
      }

      const [created] = await db
        .insert(propertyMemory)
        .values({
          id: uuidv4(),
          organizationId,
          propertyId,
          fact: fact.trim(),
          source: source ?? 'manual',
          sourceReservationId: sourceReservationId ?? null,
          createdAt: new Date(),
        })
        .returning();

      return NextResponse.json({ fact: created }, { status: 201 });
    } catch (error) {
      return handleApiError({ error, route: '/api/properties/[id]/memory POST' });
    }
  },
);
