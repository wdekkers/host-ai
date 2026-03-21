import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { inventoryItems } from '@walt/db';

type Params = { params: Promise<{ roomId: string }> };

export const GET = withPermission('inventory.read', async (_request, context: Params) => {
  const { roomId } = await context.params;
  const items = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.roomId, roomId))
    .orderBy(asc(inventoryItems.name));
  return NextResponse.json({ items });
});

const addItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().min(0).default(0),
  minQuantity: z.number().int().min(0).default(0),
});

export const POST = withPermission('inventory.create', async (request, context: Params) => {
  const { roomId } = await context.params;
  const parsed = addItemSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const id = randomUUID();
  await db.insert(inventoryItems).values({
    id,
    roomId,
    name: parsed.data.name,
    quantity: parsed.data.quantity,
    minQuantity: parsed.data.minQuantity,
  });

  return NextResponse.json({ id }, { status: 201 });
});
