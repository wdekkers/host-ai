import { NextResponse } from 'next/server';
import { updatePropertyQaEntryInputSchema } from '@walt/contracts';

import { withPermission } from '@/lib/auth/authorize';
import { updatePropertyQaEntryInSingleton } from '@/lib/command-center-store';
import { handleApiError } from '@/lib/secure-logger';

type Params = { params: Promise<{ id: string }> };

export const PATCH = withPermission(
  'drafts.write',
  async (request: Request, { params }: Params, authContext) => {
    const { id } = await params;
    try {
      const rawBody = (await request.json()) as { updatedBy?: unknown };
      const parsed = updatePropertyQaEntryInputSchema.parse(rawBody);
      const updatedBy =
        process.env.NODE_ENV !== 'production' &&
        typeof rawBody.updatedBy === 'string' &&
        rawBody.updatedBy.length > 0
          ? rawBody.updatedBy
          : authContext.userId;
      const item = updatePropertyQaEntryInSingleton(id, { ...parsed, updatedBy });
      return NextResponse.json({ item });
    } catch (error) {
      return handleApiError({ error, route: '/api/command-center/qa/entry/[id]' });
    }
  },
);
