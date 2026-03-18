type ReviewableDraft = {
  titleTag: string;
  metaDescription: string;
  slug: string;
  h1: string;
  outline: string[];
  bodyMarkdown: string;
  faqItems: Array<{ question: string; answer: string }>;
  ctaText: string;
  sourceUrls: string[];
  generatedAt: Date;
  startsAt?: Date | null;
};

export type DraftReviewResult = {
  status: 'needs_review' | 'needs_attention';
  notes: string[];
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function reviewDraft(draft: ReviewableDraft): DraftReviewResult {
  const notes: string[] = [];

  if (!draft.titleTag.trim()) notes.push('Missing title tag');
  if (!draft.metaDescription.trim()) notes.push('Missing meta description');
  if (!draft.h1.trim()) notes.push('Missing H1');
  if (draft.outline.length < 3) notes.push('Outline must include at least 3 sections');
  if (draft.bodyMarkdown.trim().length < 180) notes.push('Body content is too short');
  if (!draft.ctaText.trim()) notes.push('Missing CTA text');
  if (draft.sourceUrls.length === 0) notes.push('Missing source URLs');
  if (!slugPattern.test(draft.slug)) notes.push('Slug must be URL-safe');

  if (draft.startsAt && draft.startsAt.valueOf() < draft.generatedAt.valueOf()) {
    notes.push('Event date is already in the past');
  }

  return {
    status: notes.length > 0 ? 'needs_attention' : 'needs_review',
    notes,
  };
}
