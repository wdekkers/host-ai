import { NextResponse } from 'next/server';

import { getPropertyStateInSingleton, getRiskTrustIndicator, listQueue } from '@/lib/command-center-store';

const propertyIdFromReservation = (reservationId: string) => `property:${reservationId}`;

export async function GET() {
  const queue = listQueue();
  const propertyIds = Array.from(new Set(queue.map((item) => propertyIdFromReservation(item.reservationId))));

  const items = propertyIds.map((propertyId) => {
    const propertyQueue = queue.filter((entry) => propertyIdFromReservation(entry.reservationId) === propertyId);
    const pendingCount = propertyQueue.filter((entry) => entry.status === 'pending' || entry.status === 'edited').length;
    const highRiskCount = propertyQueue.filter(
      (entry) => getRiskTrustIndicator({ intent: entry.intent, body: entry.body }).risk === 'high'
    ).length;
    const state = getPropertyStateInSingleton(propertyId);

    return {
      propertyId,
      readiness: state.readiness,
      blockers: state.blockers,
      pendingCount,
      highRiskCount,
      updatedAt: state.updatedAt
    };
  });

  return NextResponse.json({
    items: items.sort((left, right) => {
      const readinessRank = (value: string) => (value === 'blocked' ? 2 : value === 'at-risk' ? 1 : 0);
      return readinessRank(right.readiness) - readinessRank(left.readiness) || right.pendingCount - left.pendingCount;
    })
  });
}
