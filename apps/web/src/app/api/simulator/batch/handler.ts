import { z } from 'zod';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and, asc } from 'drizzle-orm';

import type { AuthContext, KnowledgeEntry } from '@walt/contracts';
import { db } from '@/lib/db';
import {
  simulatorQuestionSets,
  simulatorQuestions,
  simulatorRuns,
  simulatorResults,
  agentConfigs,
  knowledgeEntries,
} from '@walt/db';
import { generateReplySuggestion } from '@/lib/generate-reply-suggestion';
import { gradeSimulatorResponse } from '@/lib/grade-simulator-response';
import {
  resolveKnowledgeForProperty,
  formatKnowledgeForPrompt,
  type KnowledgeEntrySource,
} from '@/lib/knowledge-resolver';

const batchSchema = z.object({
  propertyId: z.string().min(1),
  questionSetId: z.string().min(1),
});

export async function handleBatch(request: Request, authContext: AuthContext) {
  const parsed = batchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { propertyId, questionSetId } = parsed.data;

  // Verify set ownership
  const [set] = await db
    .select()
    .from(simulatorQuestionSets)
    .where(
      and(
        eq(simulatorQuestionSets.id, questionSetId),
        eq(simulatorQuestionSets.organizationId, authContext.orgId),
      ),
    )
    .limit(1);

  if (!set) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 });
  }

  // Load questions
  const questions = await db
    .select()
    .from(simulatorQuestions)
    .where(eq(simulatorQuestions.questionSetId, questionSetId))
    .orderBy(asc(simulatorQuestions.sortOrder));

  if (questions.length === 0) {
    return NextResponse.json({ error: 'Question set is empty' }, { status: 400 });
  }

  // Snapshot agent config
  const [globalConfig] = await db
    .select()
    .from(agentConfigs)
    .where(
      and(
        eq(agentConfigs.organizationId, authContext.orgId),
        eq(agentConfigs.scope, 'global'),
      ),
    )
    .limit(1);

  const [propertyConfig] = await db
    .select()
    .from(agentConfigs)
    .where(
      and(
        eq(agentConfigs.organizationId, authContext.orgId),
        eq(agentConfigs.scope, 'property'),
        eq(agentConfigs.propertyId, propertyId),
      ),
    )
    .limit(1);

  // Resolve knowledge for grading context — reuse the same DB source pattern
  // from generate-reply-suggestion.ts
  const toKnowledgeEntry = (row: typeof knowledgeEntries.$inferSelect): KnowledgeEntry => ({
    ...row,
    scope: row.scope as KnowledgeEntry['scope'],
    entryType: row.entryType as KnowledgeEntry['entryType'],
    status: row.status as KnowledgeEntry['status'],
    channels: row.channels as KnowledgeEntry['channels'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

  const knowledgeSource: KnowledgeEntrySource = {
    listKnowledgeEntries: async (args) => {
      const conditions = [eq(knowledgeEntries.organizationId, args.organizationId)];
      if (args.scope === 'global') conditions.push(eq(knowledgeEntries.scope, 'global'));
      if (args.scope === 'property' && args.propertyId) {
        conditions.push(eq(knowledgeEntries.scope, 'property'));
        conditions.push(eq(knowledgeEntries.propertyId, args.propertyId));
      }
      if (args.status) conditions.push(eq(knowledgeEntries.status, args.status));
      const rows = await db.select().from(knowledgeEntries).where(and(...conditions));
      const entries = rows.map(toKnowledgeEntry);
      // Filter by channels in JS (array column)
      if (args.channels?.length) {
        return entries.filter((r) =>
          args.channels!.some((ch) => r.channels?.includes(ch)),
        );
      }
      return entries;
    },
  };

  const knowledge = await resolveKnowledgeForProperty({
    source: knowledgeSource,
    organizationId: authContext.orgId,
    propertyId,
    channels: ['ai'],
    status: 'published',
  });

  const knowledgeContext = formatKnowledgeForPrompt(knowledge);

  // Run each question through the AI and grade
  const now = new Date();
  const defaultCheckIn = new Date(now.getTime() + 86400000).toISOString().split('T')[0] ?? null;
  const defaultCheckOut = new Date(now.getTime() + 86400000 * 4).toISOString().split('T')[0] ?? null;

  const results: Array<{
    question: string;
    response: string;
    grade: string;
    gradeReason: string;
    sortOrder: number;
  }> = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;

    // Generate AI reply (isolated — single message, no history)
    const reply = await generateReplySuggestion({
      guestFirstName: 'Test',
      guestLastName: 'Guest',
      propertyName: 'Simulator',
      propertyId,
      organizationId: authContext.orgId,
      checkIn: defaultCheckIn,
      checkOut: defaultCheckOut,
      conversationHistory: [{ body: q.question, senderType: 'guest' }],
      temperature: 0,
    });

    const response = reply ?? 'Failed to generate response';

    // Grade the response
    const gradeResult = await gradeSimulatorResponse({
      question: q.question,
      response,
      knowledgeContext,
    });

    results.push({
      question: q.question,
      response,
      grade: gradeResult.grade,
      gradeReason: gradeResult.reason,
      sortOrder: i,
    });
  }

  // Compute summary
  const summary = { good: 0, incomplete: 0, noKnowledge: 0, hallucinated: 0 };
  for (const r of results) {
    if (r.grade === 'good') summary.good++;
    else if (r.grade === 'incomplete') summary.incomplete++;
    else if (r.grade === 'no_knowledge') summary.noKnowledge++;
    else if (r.grade === 'hallucinated') summary.hallucinated++;
  }

  // Save run
  const runId = randomUUID();
  await db.insert(simulatorRuns).values({
    id: runId,
    organizationId: authContext.orgId,
    propertyId,
    questionSetId,
    summary,
    agentConfigSnapshot: {
      global: globalConfig ?? null,
      property: propertyConfig ?? null,
    },
    knowledgeCount: knowledge.length,
  });

  // Save results
  const resultRows = results.map((r) => ({
    id: randomUUID(),
    runId,
    question: r.question,
    response: r.response,
    grade: r.grade,
    gradeReason: r.gradeReason,
    sortOrder: r.sortOrder,
  }));
  await db.insert(simulatorResults).values(resultRows);

  return NextResponse.json({
    runId,
    summary,
    results: results.map((r) => ({
      question: r.question,
      response: r.response,
      grade: r.grade,
      gradeReason: r.gradeReason,
    })),
  });
}
