import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { reviewSeoDraftInputSchema } from '@walt/contracts';

import { withPermission } from '@/lib/auth/authorize';
import { handleApiError } from '@/lib/secure-logger';
import { seoDrafts } from '@walt/db';

import type { AuthContext } from '@walt/contracts';

type Params = { params: Promise<{ id: string }> };

type ExistingDraft = {
  id: string;
  organizationId: string;
  reviewNotes: string[] | null;
};

type UpdatedDraft = {
  id: string;
  status: string;
  reviewNotes: string[];
  reviewedAt: string | null;
  reviewedBy: string | null;
};

const reviewActionToStatus = {
  approve: 'approved',
  reject: 'rejected',
  needs_attention: 'needs_attention',
} as const;

type PatchSeoDraftDependencies = {
  now?: Date;
  getDraftById?: (id: string) => Promise<ExistingDraft | null>;
  updateDraft?: (args: {
    id: string;
    status: string;
    reviewNotes: string[];
    reviewedAt: Date;
    reviewedBy: string;
  }) => Promise<UpdatedDraft>;
};

async function defaultGetDraftById(id: string): Promise<ExistingDraft | null> {
  const { db } = await import('@/lib/db');
  const [draft] = await db
    .select({
      id: seoDrafts.id,
      organizationId: seoDrafts.organizationId,
      reviewNotes: seoDrafts.reviewNotes,
    })
    .from(seoDrafts)
    .where(eq(seoDrafts.id, id))
    .limit(1);

  return draft ?? null;
}

async function defaultUpdateDraft(args: {
  id: string;
  status: string;
  reviewNotes: string[];
  reviewedAt: Date;
  reviewedBy: string;
}): Promise<UpdatedDraft> {
  const { db } = await import('@/lib/db');
  const [updated] = await db
    .update(seoDrafts)
    .set({
      status: args.status,
      reviewNotes: args.reviewNotes,
      reviewedAt: args.reviewedAt,
      reviewedBy: args.reviewedBy,
      updatedAt: args.reviewedAt,
    })
    .where(eq(seoDrafts.id, args.id))
    .returning({
      id: seoDrafts.id,
      status: seoDrafts.status,
      reviewNotes: seoDrafts.reviewNotes,
      reviewedAt: seoDrafts.reviewedAt,
      reviewedBy: seoDrafts.reviewedBy,
    });

  if (!updated) throw new Error('Draft not found or update failed');

  return {
    id: updated.id,
    status: updated.status,
    reviewNotes: updated.reviewNotes ?? [],
    reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    reviewedBy: updated.reviewedBy ?? null,
  };
}

export async function handlePatchSeoDraft(
  request: Request,
  { id }: { id: string },
  authContext: Pick<AuthContext, 'orgId' | 'userId'>,
  {
    now = new Date(),
    getDraftById = defaultGetDraftById,
    updateDraft = defaultUpdateDraft,
  }: PatchSeoDraftDependencies = {},
) {
  try {
    const rawBody = (await request.json()) as unknown;
    const parsed = reviewSeoDraftInputSchema.parse(rawBody);
    const draft = await getDraftById(id);

    if (!draft || draft.organizationId !== authContext.orgId) {
      return NextResponse.json({ error: 'SEO draft not found' }, { status: 404 });
    }

    const reviewNotes = parsed.note
      ? [...(draft.reviewNotes ?? []), parsed.note]
      : (draft.reviewNotes ?? []);

    const item = await updateDraft({
      id,
      status: reviewActionToStatus[parsed.action],
      reviewNotes,
      reviewedAt: now,
      reviewedBy: authContext.userId,
    });

    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/seo-drafts/[id]' });
  }
}

export const PATCH = withPermission(
  'drafts.write',
  async (request: Request, { params }: Params, auth) => {
    const { id } = await params;
    return handlePatchSeoDraft(request, { id }, auth);
  },
);
