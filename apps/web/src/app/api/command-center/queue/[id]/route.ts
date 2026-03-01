import { updateDraftInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import {
  approveDraftInSingleton,
  editDraftInSingleton,
  rejectDraftInSingleton,
  sendDraftInSingleton
} from '@/lib/command-center-store';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const parsed = updateDraftInputSchema.parse(await request.json());

    if (parsed.action === 'edit') {
      if (!parsed.body) {
        return NextResponse.json({ error: 'body is required for edit action' }, { status: 400 });
      }
      return NextResponse.json({ item: editDraftInSingleton(id, parsed.body, parsed.actorId) });
    }

    if (parsed.action === 'approve') {
      return NextResponse.json({ item: approveDraftInSingleton(id, parsed.actorId) });
    }

    if (parsed.action === 'reject') {
      return NextResponse.json({ item: rejectDraftInSingleton(id, parsed.actorId) });
    }

    return NextResponse.json({ item: sendDraftInSingleton(id, parsed.actorId) });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/queue/[id]' });
  }
}
