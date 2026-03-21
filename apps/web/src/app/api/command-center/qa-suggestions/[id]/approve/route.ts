import { z } from 'zod';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { approvePropertyQaSuggestionInSingleton } from '@/lib/command-center-store';
import { handleApiError } from '@/lib/secure-logger';

type Params = { params: Promise<{ id: string }> };

const approveSuggestionInputSchema = z.object({
  actorId: z.string().min(1).optional(),
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
});

export const POST = withPermission(
  'questions.update',
  async (request: Request, { params }: Params, authContext) => {
    const { id } = await params;
    try {
      const rawBody = (await request.json()) as { actorId?: unknown };
      const parsed = approveSuggestionInputSchema.parse(rawBody);
      const actorId =
        process.env.NODE_ENV !== 'production' &&
        typeof rawBody.actorId === 'string' &&
        rawBody.actorId.length > 0
          ? rawBody.actorId
          : authContext.userId;
      const result = approvePropertyQaSuggestionInSingleton(id, {
        actorId,
        question: parsed.question,
        answer: parsed.answer,
      });
      return NextResponse.json(result);
    } catch (error) {
      return handleApiError({ error, route: '/api/command-center/qa-suggestions/[id]/approve' });
    }
  },
);
