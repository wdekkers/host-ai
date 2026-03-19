import { and, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { runSeoPipelineInputSchema } from '@walt/contracts';
import { seoDrafts, seoEventCandidates, seoOpportunities } from '@walt/db';

import { runSeoDraftPipeline } from '@/lib/seo-drafts/run-pipeline';
import { handleApiError } from '@/lib/secure-logger';

import type { AuthContext } from '@walt/contracts';
import type { RunSeoDraftPipelineResult } from '@/lib/seo-drafts/run-pipeline';

type DraftSummary = {
  id: string;
  status: string;
  titleTag: string;
  targetKeyword: string;
  score: number;
  eventTitle: string;
  updatedAt: string;
};

type RunSeoDraftsResponse = {
  runId: string;
  status: RunSeoDraftPipelineResult['status'];
  counts: {
    candidates: number;
    opportunities: number;
    drafts: number;
  };
  topDrafts: DraftSummary[];
  sourceFailures: {
    count: number;
    items: RunSeoDraftPipelineResult['sourceFailures'];
  };
};

export type RunSeoDraftsDependencies = {
  openAiApiKey?: string | undefined;
  runPipeline?: (input: unknown, authContext: { orgId: string; userId: string }) => Promise<RunSeoDraftPipelineResult>;
  getDraftSummaries?: (args: {
    orgId: string;
    draftIds: string[];
    limit: number;
  }) => Promise<DraftSummary[]>;
};

async function listDraftSummaries({
  orgId,
  draftIds,
  limit,
}: {
  orgId: string;
  draftIds: string[];
  limit: number;
}): Promise<DraftSummary[]> {
  if (draftIds.length === 0) {
    return [];
  }

  const { db } = await import('@/lib/db');
  const rows = await db
    .select({
      id: seoDrafts.id,
      status: seoDrafts.status,
      titleTag: seoDrafts.titleTag,
      targetKeyword: seoOpportunities.targetKeyword,
      score: seoOpportunities.score,
      eventTitle: seoEventCandidates.title,
      updatedAt: seoDrafts.updatedAt,
    })
    .from(seoDrafts)
    .innerJoin(seoOpportunities, eq(seoDrafts.opportunityId, seoOpportunities.id))
    .innerJoin(seoEventCandidates, eq(seoOpportunities.candidateId, seoEventCandidates.id))
    .where(and(eq(seoDrafts.organizationId, orgId), inArray(seoDrafts.id, draftIds)))
    .orderBy(desc(seoDrafts.updatedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    titleTag: row.titleTag,
    targetKeyword: row.targetKeyword,
    score: row.score,
    eventTitle: row.eventTitle,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function handleRunSeoDrafts(
  request: Request,
  authContext: Pick<AuthContext, 'orgId' | 'userId'>,
  {
    openAiApiKey = process.env.OPENAI_API_KEY,
    runPipeline = runSeoDraftPipeline,
    getDraftSummaries = listDraftSummaries,
  }: RunSeoDraftsDependencies = {},
) {
  try {
    if (!openAiApiKey) {
      return NextResponse.json(
        { error: 'SEO draft pipeline unavailable: OPENAI_API_KEY is not configured' },
        { status: 503 },
      );
    }

    const rawBody = (await request.json().catch(() => ({}))) as unknown;
    const input = runSeoPipelineInputSchema.parse(rawBody);
    const result = await runPipeline(input, authContext);
    const drafts = await getDraftSummaries({
      orgId: authContext.orgId,
      draftIds: result.draftIds,
      limit: 5,
    });

    const response: RunSeoDraftsResponse = {
      runId: result.runId,
      status: result.status,
      counts: {
        candidates: result.createdCandidates,
        opportunities: result.createdOpportunities,
        drafts: result.createdDrafts,
      },
      topDrafts: drafts,
      sourceFailures: {
        count: result.sourceFailureCount,
        items: result.sourceFailures,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run SEO draft pipeline';
    if (message.includes('OPENAI_API_KEY')) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return handleApiError({ error, route: '/api/command-center/seo-drafts/run' });
  }
}
