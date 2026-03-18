import { z } from 'zod';

export const marketKeySchema = z.enum(['frisco-tx']);
export const siteKeySchema = z.enum(['stayinfrisco']);

export const seoRunStatusSchema = z.enum(['running', 'completed', 'partial', 'failed']);
export const seoCandidateStatusSchema = z.enum(['discovered', 'discarded', 'promoted']);
export const seoOpportunityStatusSchema = z.enum(['queued', 'drafted', 'skipped']);
export const seoDraftStatusSchema = z.enum([
  'generated',
  'needs_review',
  'approved',
  'rejected',
  'needs_attention',
]);

export const seoEventCandidateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  marketKey: marketKeySchema,
  sourceId: z.string().min(1),
  sourceUrl: z.string().url(),
  title: z.string().min(1),
  venueName: z.string().nullish(),
  city: z.string().nullish(),
  startsAt: z.string().nullish(),
  endsAt: z.string().nullish(),
  summary: z.string().nullish(),
  sourceSnippet: z.string().nullish(),
  normalizedHash: z.string().min(1),
  status: seoCandidateStatusSchema,
  discoveredAt: z.string().min(1),
});

export const seoOpportunitySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  candidateId: z.string().uuid(),
  marketKey: marketKeySchema,
  siteKey: siteKeySchema,
  targetKeyword: z.string().min(1),
  targetSlug: z.string().min(1),
  travelerIntent: z.string().min(1),
  propertyIds: z.array(z.string().min(1)).min(1),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string().min(1)).min(1),
  status: seoOpportunityStatusSchema,
  evaluatedAt: z.string().min(1),
});

export const seoDraftSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  opportunityId: z.string().uuid(),
  siteKey: siteKeySchema,
  marketKey: marketKeySchema,
  titleTag: z.string().min(1),
  metaDescription: z.string().min(1),
  slug: z.string().min(1),
  h1: z.string().min(1),
  outline: z.array(z.string().min(1)).min(3),
  bodyMarkdown: z.string().min(1),
  faqItems: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
      }),
    )
    .min(0),
  ctaText: z.string().min(1),
  internalLinks: z
    .array(
      z.object({
        href: z.string().min(1),
        anchor: z.string().min(1),
      }),
    )
    .min(0),
  sourceUrls: z.array(z.string().url()).min(1),
  reviewNotes: z.array(z.string()).default([]),
  status: seoDraftStatusSchema,
  generatedAt: z.string().min(1),
  reviewedAt: z.string().nullish(),
});

export const runSeoPipelineInputSchema = z.object({
  marketKey: marketKeySchema.default('frisco-tx'),
  siteKey: siteKeySchema.default('stayinfrisco'),
  maxCandidates: z.coerce.number().int().min(1).max(25).default(10),
});

export const reviewSeoDraftInputSchema = z.object({
  action: z.enum(['approve', 'reject', 'needs_attention']),
  note: z.string().trim().max(500).optional(),
});

export type SeoEventCandidate = z.infer<typeof seoEventCandidateSchema>;
export type SeoOpportunity = z.infer<typeof seoOpportunitySchema>;
export type SeoDraft = z.infer<typeof seoDraftSchema>;
export type RunSeoPipelineInput = z.infer<typeof runSeoPipelineInputSchema>;
export type ReviewSeoDraftInput = z.infer<typeof reviewSeoDraftInputSchema>;
