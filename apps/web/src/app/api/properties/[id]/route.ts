import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { properties } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

const updatePropertySchema = z.object({
  isActive: z.boolean().optional(),
});

export const PATCH = withPermission('properties.update', async (request, context: Params) => {
  const { id } = await context.params;
  const parsed = updatePropertySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const [updated] = await db
    .update(properties)
    .set(updates)
    .where(eq(properties.id, id))
    .returning({ id: properties.id, isActive: properties.isActive });

  if (!updated) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  }

  return NextResponse.json({ property: updated });
});
