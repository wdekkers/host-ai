import { z } from 'zod';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and, asc, inArray } from 'drizzle-orm';

import type { AuthContext } from '@walt/contracts';
import { db } from '@/lib/db';
import {
  simulatorQuestionSets,
  simulatorQuestions,
} from '@walt/db';

const createSetSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1),
  questions: z.array(z.string().min(1)).optional(),
});

const updateSetSchema = z.object({
  name: z.string().min(1),
});

const addQuestionSchema = z.object({
  question: z.string().min(1),
});

const updateQuestionSchema = z.object({
  question: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function handleListSets(request: Request, authContext: AuthContext) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get('propertyId');
  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
  }

  const sets = await db
    .select()
    .from(simulatorQuestionSets)
    .where(
      and(
        eq(simulatorQuestionSets.organizationId, authContext.orgId),
        eq(simulatorQuestionSets.propertyId, propertyId),
      ),
    )
    .orderBy(asc(simulatorQuestionSets.name));

  // Load question counts per set
  const setIds = sets.map((s) => s.id);
  const questions = setIds.length > 0
    ? await db.select().from(simulatorQuestions).where(inArray(simulatorQuestions.questionSetId, setIds))
    : [];

  const countBySet = new Map<string, number>();
  for (const q of questions) {
    countBySet.set(q.questionSetId, (countBySet.get(q.questionSetId) ?? 0) + 1);
  }

  return NextResponse.json({
    questionSets: sets.map((s) => ({
      ...s,
      questionCount: countBySet.get(s.id) ?? 0,
    })),
  });
}

export async function handleCreateSet(request: Request, authContext: AuthContext) {
  const parsed = createSetSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const setId = randomUUID();
  await db.insert(simulatorQuestionSets).values({
    id: setId,
    organizationId: authContext.orgId,
    propertyId: parsed.data.propertyId,
    name: parsed.data.name,
  });

  // If initial questions provided (from template), insert them
  if (parsed.data.questions?.length) {
    const questionRows = parsed.data.questions.map((q, idx) => ({
      id: randomUUID(),
      questionSetId: setId,
      question: q,
      sortOrder: idx,
    }));
    await db.insert(simulatorQuestions).values(questionRows);
  }

  return NextResponse.json({ id: setId }, { status: 201 });
}

export async function handleUpdateSet(
  request: Request,
  setId: string,
  authContext: AuthContext,
) {
  const parsed = updateSetSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const [updated] = await db
    .update(simulatorQuestionSets)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(
      and(
        eq(simulatorQuestionSets.id, setId),
        eq(simulatorQuestionSets.organizationId, authContext.orgId),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 });
  }

  return NextResponse.json({ questionSet: updated });
}

export async function handleDeleteSet(setId: string, authContext: AuthContext) {
  // Delete questions first
  await db.delete(simulatorQuestions).where(eq(simulatorQuestions.questionSetId, setId));

  const [deleted] = await db
    .delete(simulatorQuestionSets)
    .where(
      and(
        eq(simulatorQuestionSets.id, setId),
        eq(simulatorQuestionSets.organizationId, authContext.orgId),
      ),
    )
    .returning({ id: simulatorQuestionSets.id });

  if (!deleted) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}

export async function handleAddQuestion(
  request: Request,
  setId: string,
  authContext: AuthContext,
) {
  const parsed = addQuestionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  // Verify set ownership
  const [set] = await db
    .select({ id: simulatorQuestionSets.id })
    .from(simulatorQuestionSets)
    .where(
      and(
        eq(simulatorQuestionSets.id, setId),
        eq(simulatorQuestionSets.organizationId, authContext.orgId),
      ),
    )
    .limit(1);

  if (!set) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 });
  }

  const id = randomUUID();
  await db.insert(simulatorQuestions).values({
    id,
    questionSetId: setId,
    question: parsed.data.question,
    sortOrder: 999,
  });

  return NextResponse.json({ id }, { status: 201 });
}

export async function handleUpdateQuestion(
  request: Request,
  questionId: string,
) {
  const parsed = updateQuestionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.question !== undefined) updates.question = parsed.data.question;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;

  const [updated] = await db
    .update(simulatorQuestions)
    .set(updates)
    .where(eq(simulatorQuestions.id, questionId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  return NextResponse.json({ question: updated });
}

export async function handleDeleteQuestion(questionId: string) {
  const [deleted] = await db
    .delete(simulatorQuestions)
    .where(eq(simulatorQuestions.id, questionId))
    .returning({ id: simulatorQuestions.id });

  if (!deleted) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}

export async function handleGetSetWithQuestions(setId: string, authContext: AuthContext) {
  const [set] = await db
    .select()
    .from(simulatorQuestionSets)
    .where(
      and(
        eq(simulatorQuestionSets.id, setId),
        eq(simulatorQuestionSets.organizationId, authContext.orgId),
      ),
    )
    .limit(1);

  if (!set) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 });
  }

  const questions = await db
    .select()
    .from(simulatorQuestions)
    .where(eq(simulatorQuestions.questionSetId, setId))
    .orderBy(asc(simulatorQuestions.sortOrder));

  return NextResponse.json({ ...set, questions });
}
