import { z } from 'zod';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and, asc } from 'drizzle-orm';

import type { AuthContext } from '@walt/contracts';
import { db } from '@/lib/db';
import { propertyAppliances } from '@walt/db';

const createSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional(),
  modelNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  location: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyExpiration: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  brand: z.string().nullable().optional(),
  modelNumber: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  warrantyExpiration: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function handleList(request: Request, authContext: AuthContext) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get('propertyId');
  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
  }

  const includeInactive = url.searchParams.get('includeInactive') === 'true';

  const conditions = [
    eq(propertyAppliances.propertyId, propertyId),
    eq(propertyAppliances.organizationId, authContext.orgId),
  ];
  if (!includeInactive) {
    conditions.push(eq(propertyAppliances.isActive, true));
  }

  const appliances = await db
    .select()
    .from(propertyAppliances)
    .where(and(...conditions))
    .orderBy(asc(propertyAppliances.name));

  return NextResponse.json({ appliances });
}

export async function handleCreate(request: Request, authContext: AuthContext) {
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const id = randomUUID();
  const { purchaseDate, warrantyExpiration, ...rest } = parsed.data;

  await db.insert(propertyAppliances).values({
    id,
    organizationId: authContext.orgId,
    ...rest,
    purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
    warrantyExpiration: warrantyExpiration ? new Date(warrantyExpiration) : null,
  });

  return NextResponse.json({ id }, { status: 201 });
}

export async function handleUpdate(
  request: Request,
  applianceId: string,
  authContext: AuthContext,
) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const data = parsed.data;

  if (data.name !== undefined) updates.name = data.name;
  if (data.brand !== undefined) updates.brand = data.brand;
  if (data.modelNumber !== undefined) updates.modelNumber = data.modelNumber;
  if (data.serialNumber !== undefined) updates.serialNumber = data.serialNumber;
  if (data.location !== undefined) updates.location = data.location;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.isActive !== undefined) updates.isActive = data.isActive;
  if (data.purchaseDate !== undefined) {
    updates.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null;
  }
  if (data.warrantyExpiration !== undefined) {
    updates.warrantyExpiration = data.warrantyExpiration ? new Date(data.warrantyExpiration) : null;
  }

  const [updated] = await db
    .update(propertyAppliances)
    .set(updates)
    .where(
      and(
        eq(propertyAppliances.id, applianceId),
        eq(propertyAppliances.organizationId, authContext.orgId),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Appliance not found' }, { status: 404 });
  }

  return NextResponse.json({ appliance: updated });
}

export async function handleDelete(applianceId: string, authContext: AuthContext) {
  const [deleted] = await db
    .delete(propertyAppliances)
    .where(
      and(
        eq(propertyAppliances.id, applianceId),
        eq(propertyAppliances.organizationId, authContext.orgId),
      ),
    )
    .returning({ id: propertyAppliances.id });

  if (!deleted) {
    return NextResponse.json({ error: 'Appliance not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
