import { NextResponse } from 'next/server';

import {
  getMonitoringAgentStatusInSingleton,
  listMonitoringAlertsInSingleton,
  runMonitoringAgentsInSingleton
} from '@/lib/command-center-store';

const validStatus = new Set(['open', 'acknowledged', 'resolved']);
const validSeverity = new Set(['low', 'medium', 'high']);
const validCategory = new Set(['upcoming-check-in', 'missing-confirmation', 'vendor-window', 'amenity-issue']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get('propertyId') ?? undefined;
  const reservationId = url.searchParams.get('reservationId') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const severity = url.searchParams.get('severity') ?? undefined;
  const category = url.searchParams.get('category') ?? undefined;
  const limitParam = url.searchParams.get('limit');
  const includeAgentStatus = url.searchParams.get('includeAgentStatus') === '1';

  if (status && !validStatus.has(status)) {
    return NextResponse.json({ error: 'Invalid status filter.' }, { status: 400 });
  }
  if (severity && !validSeverity.has(severity)) {
    return NextResponse.json({ error: 'Invalid severity filter.' }, { status: 400 });
  }
  if (category && !validCategory.has(category)) {
    return NextResponse.json({ error: 'Invalid category filter.' }, { status: 400 });
  }

  let limit: number | undefined;
  if (limitParam) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      return NextResponse.json({ error: 'limit must be between 1 and 50.' }, { status: 400 });
    }
    limit = parsed;
  }

  const items = listMonitoringAlertsInSingleton({
    propertyId,
    reservationId,
    status: status as 'open' | 'acknowledged' | 'resolved' | undefined,
    severity: severity as 'low' | 'medium' | 'high' | undefined,
    category: category as 'upcoming-check-in' | 'missing-confirmation' | 'vendor-window' | 'amenity-issue' | undefined,
    limit
  });
  if (includeAgentStatus) {
    return NextResponse.json({
      items,
      agentStatus: getMonitoringAgentStatusInSingleton()
    });
  }
  return NextResponse.json({ items });
}

export async function POST() {
  return NextResponse.json({
    items: runMonitoringAgentsInSingleton()
  });
}
