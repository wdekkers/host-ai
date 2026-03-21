import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { inventoryRooms, inventoryItems } from '@walt/db';

const DEFAULT_ROOMS = [
  'Living Room', 'Kitchen', 'Master Bedroom', 'Bedroom 2', 'Bedroom 3',
  'Bathroom 1', 'Bathroom 2', 'Garage', 'Patio / Outdoor', 'Pool Area', 'Laundry',
];

export const GET = withPermission('inventory.read', async (request) => {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get('propertyId');
  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
  }

  let rooms = await db
    .select()
    .from(inventoryRooms)
    .where(eq(inventoryRooms.propertyId, propertyId))
    .orderBy(asc(inventoryRooms.sortOrder));

  // Auto-create default rooms if none exist
  if (rooms.length === 0) {
    const values = DEFAULT_ROOMS.map((name, idx) => ({
      id: randomUUID(),
      propertyId,
      name,
      sortOrder: idx,
    }));
    await db.insert(inventoryRooms).values(values);
    rooms = values;
  }

  // Load items for all rooms
  const roomIds = rooms.map((r) => r.id);
  const items = roomIds.length > 0
    ? await db.select().from(inventoryItems).orderBy(asc(inventoryItems.name))
    : [];

  const itemsByRoom = new Map<string, typeof items>();
  for (const item of items) {
    if (!roomIds.includes(item.roomId)) continue;
    const list = itemsByRoom.get(item.roomId) ?? [];
    list.push(item);
    itemsByRoom.set(item.roomId, list);
  }

  return NextResponse.json({
    rooms: rooms.map((r) => ({
      ...r,
      items: itemsByRoom.get(r.id) ?? [],
    })),
  });
});

const createRoomSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1),
});

export const POST = withPermission('inventory.create', async (request) => {
  const parsed = createRoomSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const id = randomUUID();
  await db.insert(inventoryRooms).values({
    id,
    propertyId: parsed.data.propertyId,
    name: parsed.data.name,
    sortOrder: 999,
  });

  return NextResponse.json({ id }, { status: 201 });
});
