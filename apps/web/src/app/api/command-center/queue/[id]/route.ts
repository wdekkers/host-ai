import { updateDraftInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { handleApiError } from '@/lib/secure-logger';

import {
  approveDraftInSingleton,
  editDraftInSingleton,
  rejectDraftInSingleton,
  sendDraftInSingleton,
} from '@/lib/command-center-store';

type Params = { params: Promise<{ id: string }> };

export const PATCH = withPermission(
  'inbox.create',
  async (request: Request, { params }: Params, authContext) => {
    const { id } = await params;

    try {
      const rawBody = (await request.json()) as {
        actorId?: unknown;
        action?: unknown;
        body?: unknown;
      };
      const parsed = updateDraftInputSchema.parse(rawBody);
      const actorId =
        process.env.NODE_ENV !== 'production' &&
        typeof rawBody.actorId === 'string' &&
        rawBody.actorId.length > 0
          ? rawBody.actorId
          : authContext.userId;

      if (parsed.action === 'edit') {
        if (!parsed.body) {
          return NextResponse.json({ error: 'body is required for edit action' }, { status: 400 });
        }
        return NextResponse.json({ item: editDraftInSingleton(id, parsed.body, actorId) });
      }

      if (parsed.action === 'approve') {
        return NextResponse.json({ item: approveDraftInSingleton(id, actorId) });
      }

      if (parsed.action === 'reject') {
        return NextResponse.json({ item: rejectDraftInSingleton(id, actorId) });
      }

      return NextResponse.json({ item: sendDraftInSingleton(id, actorId) });
    } catch (error) {
      return handleApiError({ error, route: '/api/command-center/queue/[id]' });
    }
  },
);
