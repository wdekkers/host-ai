import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { seoDrafts, seoEventCandidates, seoOpportunities, seoPipelineRuns } from '@walt/db';
import { runSeoPipelineInputSchema } from '@walt/contracts';

import { db } from '@/lib/db';

import { scoutEvents } from './event-scout';
import { generateDraft } from './draft-generator';
import {
  rankCandidatesForDrafting,
  scoreEventForProperties,
  shouldDraftOpportunity,
} from './opportunity-scorer';
import { getFriscoPropertyContext } from './property-context';
import { reviewDraft } from './reviewer';

import type { ScoutSourceFailure } from './event-scout';

type AuthContext = {
  orgId: string;
  userId: string;
};

type RunPipelineDependencies = {
  scout?: typeof scoutEvents;
  loadProperties?: typeof getFriscoPropertyContext;
  now?: Date;
};

export type RunSeoDraftPipelineResult = {
  runId: string;
  status: 'completed' | 'partial';
  createdCandidates: number;
  createdOpportunities: number;
  createdDrafts: number;
  draftIds: string[];
  sourceFailureCount: number;
  sourceFailures: ScoutSourceFailure[];
};

export async function runSeoDraftPipeline(
  input: unknown,
  authContext: AuthContext,
  {
    scout = scoutEvents,
    loadProperties = getFriscoPropertyContext,
    now = new Date(),
  }: RunPipelineDependencies = {},
): Promise<RunSeoDraftPipelineResult> {
  const parsed = runSeoPipelineInputSchema.parse(input);
  const runId = randomUUID();

  await db.insert(seoPipelineRuns).values({
    id: runId,
    organizationId: authContext.orgId,
    marketKey: parsed.marketKey,
    siteKey: parsed.siteKey,
    trigger: 'manual',
    status: 'running',
    createdBy: authContext.userId,
    startedAt: now,
    metadata: { maxCandidates: parsed.maxCandidates },
  });

  try {
    const [properties, scouted] = await Promise.all([loadProperties(), scout()]);
    const rankedCandidates = rankCandidatesForDrafting(
      scouted.candidates,
      properties,
      parsed.maxCandidates,
      now,
    );
    const selectedCandidateIds = new Set(
      rankedCandidates.map((entry) => entry.candidate.id),
    );

    let createdCandidates = 0;
    let createdOpportunities = 0;
    let createdDrafts = 0;
    const draftIds: string[] = [];
    const runStatus = scouted.partial ? 'partial' : 'completed';

    for (const candidate of scouted.candidates) {
      const candidateInsert = await db
        .insert(seoEventCandidates)
        .values({
          id: candidate.id,
          runId,
          organizationId: authContext.orgId,
          marketKey: parsed.marketKey,
          sourceId: candidate.sourceId,
          sourceUrl: candidate.sourceUrl,
          sourceDomain: candidate.sourceDomain,
          title: candidate.title,
          venueName: candidate.venueName,
          city: candidate.city,
          startsAt: candidate.startsAt,
          endsAt: candidate.endsAt,
          summary: candidate.summary,
          sourceSnippet: candidate.sourceSnippet,
          normalizedHash: candidate.normalizedHash,
          status: 'discovered',
          raw: candidate.raw,
          discoveredAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: seoEventCandidates.id });

      if (candidateInsert.length === 0) {
        continue;
      }

      createdCandidates += 1;

      const ranked = rankedCandidates.find((entry) => entry.candidate.id === candidate.id);
      const scored = ranked?.scored ?? scoreEventForProperties(candidate, properties, now);

      if (!selectedCandidateIds.has(candidate.id) || !shouldDraftOpportunity(scored)) {
        await db
          .update(seoEventCandidates)
          .set({ status: 'discarded' })
          .where(eq(seoEventCandidates.id, candidate.id));
        continue;
      }

      await db
        .update(seoEventCandidates)
        .set({ status: 'promoted' })
        .where(eq(seoEventCandidates.id, candidate.id));

      const opportunityId = randomUUID();

      await db.insert(seoOpportunities).values({
        id: opportunityId,
        candidateId: candidate.id,
        organizationId: authContext.orgId,
        marketKey: parsed.marketKey,
        siteKey: parsed.siteKey,
        targetKeyword: scored.targetKeyword,
        targetSlug: scored.targetSlug,
        travelerIntent: scored.travelerIntent,
        propertyIds: scored.propertyIds,
        score: scored.score,
        reasons: scored.reasons,
        status: 'drafted',
        evaluatedAt: now,
      });

      createdOpportunities += 1;

      const generated = await generateDraft(candidate, scored, properties);
      const review = reviewDraft({
        ...generated,
        generatedAt: now,
        startsAt: candidate.startsAt,
      });
      const draftId = randomUUID();

      await db.insert(seoDrafts).values({
        id: draftId,
        opportunityId,
        organizationId: authContext.orgId,
        marketKey: parsed.marketKey,
        siteKey: parsed.siteKey,
        status: review.status,
        titleTag: generated.titleTag,
        metaDescription: generated.metaDescription,
        slug: generated.slug,
        h1: generated.h1,
        outline: generated.outline,
        bodyMarkdown: generated.bodyMarkdown,
        faqItems: generated.faqItems,
        ctaText: generated.ctaText,
        internalLinks: generated.internalLinks,
        sourceUrls: generated.sourceUrls,
        reviewNotes: review.notes,
        generatedAt: now,
        updatedAt: now,
      });

      createdDrafts += 1;
      draftIds.push(draftId);
    }

    await db
      .update(seoPipelineRuns)
      .set({
        status: runStatus,
        completedAt: new Date(),
        metadata: {
          maxCandidates: parsed.maxCandidates,
          createdCandidates,
          createdOpportunities,
          createdDrafts,
          sourceFailureCount: scouted.sourceFailures.length,
          sourceFailures: scouted.sourceFailures,
        },
      })
      .where(eq(seoPipelineRuns.id, runId));

    return {
      runId,
      status: runStatus,
      createdCandidates,
      createdOpportunities,
      createdDrafts,
      draftIds,
      sourceFailureCount: scouted.sourceFailures.length,
      sourceFailures: scouted.sourceFailures,
    };
  } catch (error) {
    await db
      .update(seoPipelineRuns)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorSummary: error instanceof Error ? error.message : 'Unknown SEO pipeline failure',
      })
      .where(eq(seoPipelineRuns.id, runId));
    throw error;
  }
}
