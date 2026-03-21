import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { inventoryItems } from '@walt/db';

type Params = { params: Promise<{ roomId: string; itemId: string }> };

const updateItemSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  minQuantity: z.number().int().min(0).optional(),
  name: z.string().min(1).optional(),
});

export const PATCH = withPermission('inventory.update', async (request, context: Params) => {
  const { itemId } = await context.params;
  const parsed = updateItemSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.quantity !== undefined) updates.quantity = parsed.data.quantity;
  if (parsed.data.minQuantity !== undefined) updates.minQuantity = parsed.data.minQuantity;
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;

  const [updated] = await db
    .update(inventoryItems)
    .set(updates)
    .where(eq(inventoryItems.id, itemId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  return NextResponse.json({ item: updated });
});

export const DELETE = withPermission('inventory.delete', async (_request, context: Params) => {
  const { itemId } = await context.params;

  const [deleted] = await db
    .delete(inventoryItems)
    .where(eq(inventoryItems.id, itemId))
    .returning({ id: inventoryItems.id });

  if (!deleted) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
});
