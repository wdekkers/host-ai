import { updateDraftInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import {
  approveDraftInSingleton,
  editDraftInSingleton,
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
      return NextResponse.json({ item: editDraftInSingleton(id, parsed.body) });
    }

    if (parsed.action === 'approve') {
      return NextResponse.json({ item: approveDraftInSingleton(id, parsed.actorId) });
    }

    return NextResponse.json({ item: sendDraftInSingleton(id, parsed.actorId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
