import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

type ChecklistExecution = {
  propertyId: string;
  completedItemIds: string[];
  updatedAt: string;
};

const executions = new Map<string, ChecklistExecution>();

const upsertExecutionInputSchema = z.object({
  propertyId: z.string().min(1),
  completedItemIds: z.array(z.string().min(1))
});

export async function GET(request: Request) {
  try {
    const propertyId = new URL(request.url).searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required.' }, { status: 400 });
    }

    const existing = executions.get(propertyId) ?? {
      propertyId,
      completedItemIds: [],
      updatedAt: new Date(0).toISOString()
    };
    return NextResponse.json({ execution: existing });
  } catch (error) {
    return handleApiError({ error, route: '/api/property-checklists/executions' });
  }
}

export async function PUT(request: Request) {
  try {
    const parsed = upsertExecutionInputSchema.parse(await request.json());
    const execution: ChecklistExecution = {
      propertyId: parsed.propertyId,
      completedItemIds: Array.from(new Set(parsed.completedItemIds)),
      updatedAt: new Date().toISOString()
    };
    executions.set(parsed.propertyId, execution);
    return NextResponse.json({ execution });
  } catch (error) {
    return handleApiError({ error, route: '/api/property-checklists/executions' });
  }
}
