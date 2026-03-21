import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { checklists, checklistItems } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

export const GET = withPermission('checklists.read', async (_request, context: Params, auth) => {
  const { id } = await context.params;

  const [checklist] = await db
    .select()
    .from(checklists)
    .where(and(eq(checklists.id, id), eq(checklists.organizationId, auth.orgId)));

  if (!checklist) {
    return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
  }

  const items = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.checklistId, id))
    .orderBy(checklistItems.sortOrder);

  return NextResponse.json({ checklist, items });
});

const updateChecklistSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(['turnover', 'house_manager', 'maintenance', 'seasonal']).optional(),
  assignedRole: z.string().nullable().optional(),
});

export const PATCH = withPermission('checklists.update', async (request, context: Params, auth) => {
  const { id } = await context.params;
  const parsed = updateChecklistSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (parsed.data.assignedRole !== undefined) updates.assignedRole = parsed.data.assignedRole;

  const [updated] = await db
    .update(checklists)
    .set(updates)
    .where(and(eq(checklists.id, id), eq(checklists.organizationId, auth.orgId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
  }

  return NextResponse.json({ checklist: updated });
});

export const DELETE = withPermission('checklists.delete', async (_request, context: Params, auth) => {
  const { id } = await context.params;

  const [deleted] = await db
    .delete(checklists)
    .where(and(eq(checklists.id, id), eq(checklists.organizationId, auth.orgId)))
    .returning({ id: checklists.id });

  if (!deleted) {
    return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
  }

  // Delete associated items
  await db.delete(checklistItems).where(eq(checklistItems.checklistId, id));

  return NextResponse.json({ deleted: true });
});
