import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { assembleContextByDraftIdInSingleton, getRiskTrustIndicator } from '@/lib/command-center-store';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const context = assembleContextByDraftIdInSingleton(id);
    const riskTrustBadge = getRiskTrustIndicator({
      intent: context.intent,
      body: `${context.policy} ${context.knowledgeSources.map((source) => source.snippet).join(' ')}`
    });
    const intentLabel = context.intent
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

    return NextResponse.json({
      context: {
        ...context,
        intentLabel,
        riskTrustBadge
      }
    });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/context/[id]' });
  }
}
