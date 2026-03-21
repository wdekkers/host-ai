import { and, eq, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { checklists, checklistItems } from '@walt/db';

export const GET = withPermission('checklists.read', async (request, _context, auth) => {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get('propertyId');
  const category = url.searchParams.get('category');

  const conditions = [eq(checklists.organizationId, auth.orgId)];

  if (propertyId) {
    // Show global checklists + property-specific for this property
    conditions.push(
      or(
        eq(checklists.scope, 'global'),
        eq(checklists.propertyId, propertyId),
      )!,
    );
  }

  if (category) {
    conditions.push(eq(checklists.category, category as 'turnover' | 'house_manager' | 'maintenance' | 'seasonal'));
  }

  // If cleaner role, only show checklists assigned to cleaner (or unassigned)
  if (auth.role === 'cleaner') {
    conditions.push(
      or(
        eq(checklists.assignedRole, 'cleaner'),
        eq(checklists.assignedRole, ''),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(checklists)
    .where(and(...conditions))
    .orderBy(checklists.name);

  return NextResponse.json({ checklists: rows });
});

const createChecklistSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['turnover', 'house_manager', 'maintenance', 'seasonal']),
  scope: z.enum(['global', 'property']),
  propertyId: z.string().optional(),
  assignedRole: z.string().optional(),
  items: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
  })).optional(),
});

export const POST = withPermission('checklists.create', async (request, _context, auth) => {
  const parsed = createChecklistSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  if (parsed.data.scope === 'property' && !parsed.data.propertyId) {
    return NextResponse.json({ error: 'propertyId required for property-scoped checklists' }, { status: 400 });
  }

  const checklistId = randomUUID();

  await db.insert(checklists).values({
    id: checklistId,
    organizationId: auth.orgId,
    name: parsed.data.name,
    category: parsed.data.category,
    scope: parsed.data.scope,
    propertyId: parsed.data.scope === 'global' ? null : (parsed.data.propertyId ?? null),
    assignedRole: parsed.data.assignedRole ?? null,
  });

  if (parsed.data.items?.length) {
    await db.insert(checklistItems).values(
      parsed.data.items.map((item, idx) => ({
        id: randomUUID(),
        checklistId,
        title: item.title,
        description: item.description ?? null,
        sortOrder: idx,
      })),
    );
  }

  return NextResponse.json({ id: checklistId }, { status: 201 });
});
