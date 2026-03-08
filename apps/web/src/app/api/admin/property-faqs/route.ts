import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { propertyFaqs } from '@walt/db';
import { db } from '@/lib/db';

const patchSchema = z.object({
  id: z.string().uuid(),
  answer: z.string().min(1),
});

export async function PATCH(request: Request) {
  const body = (await request.json()) as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  await db
    .update(propertyFaqs)
    .set({ answer: parsed.data.answer, updatedAt: new Date() })
    .where(eq(propertyFaqs.id, parsed.data.id));

  return NextResponse.json({ ok: true });
}
