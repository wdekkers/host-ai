import { NextResponse } from 'next/server';
import { createPropertyQaEntryInputSchema } from '@walt/contracts';

import { withPermission } from '@/lib/auth/authorize';
import {
  createPropertyQaEntryInSingleton,
  listPropertyQaEntriesInSingleton,
} from '@/lib/command-center-store';
import { handleApiError } from '@/lib/secure-logger';

type Params = { params: Promise<{ propertyId: string }> };

export const GET = withPermission(
  'questions.read',
  async (request: Request, { params }: Params) => {
    const { propertyId } = await params;
    const statusRaw = new URL(request.url).searchParams.get('status');
    const status = statusRaw === 'active' || statusRaw === 'archived' ? statusRaw : undefined;
    return NextResponse.json({ items: listPropertyQaEntriesInSingleton(propertyId, status) });
  },
);

export const POST = withPermission(
  'questions.update',
  async (request: Request, { params }: Params, authContext) => {
    const { propertyId } = await params;
    try {
      const rawBody = (await request.json()) as { createdBy?: unknown };
      const parsed = createPropertyQaEntryInputSchema.parse(rawBody);
      const createdBy =
        process.env.NODE_ENV !== 'production' &&
        typeof rawBody.createdBy === 'string' &&
        rawBody.createdBy.length > 0
          ? rawBody.createdBy
          : authContext.userId;
      const item = createPropertyQaEntryInSingleton(propertyId, { ...parsed, createdBy });
      return NextResponse.json({ item });
    } catch (error) {
      return handleApiError({ error, route: '/api/command-center/qa/[propertyId]' });
    }
  },
);
