import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

type CleanerThread = {
  cleanerId: string;
  cleanerPhone: string;
  readinessSignal: string;
  updatedAt: string;
};

const state: {
  opsNumber: string;
  threads: CleanerThread[];
} = {
  opsNumber: '+15550000000',
  threads: []
};

const inputSchema = z.object({
  opsNumber: z.string().min(5),
  cleanerId: z.string().min(1),
  cleanerPhone: z.string().min(5),
  readinessSignal: z.string().min(1)
});

export async function GET(_request: Request) {
  void _request;
  return NextResponse.json({
    opsNumber: state.opsNumber,
    threads: [...state.threads].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  });
}

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.parse(await request.json());
    state.opsNumber = parsed.opsNumber;
    const existing = state.threads.find((thread) => thread.cleanerId === parsed.cleanerId);
    const updatedAt = new Date().toISOString();
    if (existing) {
      existing.cleanerPhone = parsed.cleanerPhone;
      existing.readinessSignal = parsed.readinessSignal;
      existing.updatedAt = updatedAt;
    } else {
      state.threads.push({
        cleanerId: parsed.cleanerId,
        cleanerPhone: parsed.cleanerPhone,
        readinessSignal: parsed.readinessSignal,
        updatedAt
      });
    }

    return NextResponse.json({
      opsNumber: state.opsNumber,
      threads: [...state.threads].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    });
  } catch (error) {
    return handleApiError({ error, route: '/api/integrations/twilio/threads' });
  }
}
