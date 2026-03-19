import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { seoDraftStatusSchema } from '@walt/contracts';
import { seoDrafts, seoEventCandidates, seoOpportunities } from '@walt/db';

import { handleApiError } from '@/lib/secure-logger';

import type { AuthContext } from '@walt/contracts';

const querySchema = z.object({
  status: seoDraftStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export type SeoDraftListItem = {
  id: string;
  status: string;
  titleTag: string;
  slug: string;
  targetKeyword: string;
  score: number;
  eventTitle: string;
  sourceUrl: string;
  reviewNotes: string[];
  updatedAt: string;
};

type ListSeoDraftsDependencies = {
  queryDrafts?: (args: {
    orgId: string;
    status?: string;
    limit: number;
  }) => Promise<SeoDraftListItem[]>;
};

async function querySeoDrafts({
  orgId,
  status,
  limit,
}: {
  orgId: string;
  status?: string;
  limit: number;
}): Promise<SeoDraftListItem[]> {
  const { db } = await import('@/lib/db');
  const filters = [eq(seoDrafts.organizationId, orgId)];
  if (status) {
    filters.push(eq(seoDrafts.status, status));
  }

  const rows = await db
    .select({
      id: seoDrafts.id,
      status: seoDrafts.status,
      titleTag: seoDrafts.titleTag,
      slug: seoDrafts.slug,
      targetKeyword: seoOpportunities.targetKeyword,
      score: seoOpportunities.score,
      eventTitle: seoEventCandidates.title,
      sourceUrl: seoEventCandidates.sourceUrl,
      reviewNotes: seoDrafts.reviewNotes,
      updatedAt: seoDrafts.updatedAt,
    })
    .from(seoDrafts)
    .innerJoin(seoOpportunities, eq(seoDrafts.opportunityId, seoOpportunities.id))
    .innerJoin(seoEventCandidates, eq(seoOpportunities.candidateId, seoEventCandidates.id))
    .where(and(...filters))
    .orderBy(desc(seoDrafts.updatedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    titleTag: row.titleTag,
    slug: row.slug,
    targetKeyword: row.targetKeyword,
    score: row.score,
    eventTitle: row.eventTitle,
    sourceUrl: row.sourceUrl,
    reviewNotes: row.reviewNotes ?? [],
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function handleListSeoDrafts(
  request: Request,
  authContext: Pick<AuthContext, 'orgId'>,
  { queryDrafts = querySeoDrafts }: ListSeoDraftsDependencies = {},
) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });

    const items = await queryDrafts({
      orgId: authContext.orgId,
      status: parsed.status,
      limit: parsed.limit,
    });

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/seo-drafts' });
  }
}
