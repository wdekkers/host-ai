import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { handleApiError } from '@/lib/secure-logger';
import { handleScoreGuest } from './handler';

type Params = { params: Promise<{ reservationId: string }> };

export const POST = withPermission(
  'inbox.read',
  async (_request: Request, { params }: Params) => {
    try {
      const { reservationId } = await params;
      const result = await handleScoreGuest(reservationId);

      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      return NextResponse.json(result);
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/score' });
    }
  },
);
