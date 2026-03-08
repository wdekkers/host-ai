import { NextResponse } from 'next/server';

import {
  getIncidentTimelineInSingleton,
  getRoiMetricsInSingleton,
  listCleanerJitPingsInSingleton,
  listIncidentsInSingleton,
  listQueue,
} from '@/lib/command-center-store';

export async function GET() {
  const queue = listQueue();
  const incidents = listIncidentsInSingleton();
  const cleanerPings = listCleanerJitPingsInSingleton();
  const roi = getRoiMetricsInSingleton();

  const sentItems = queue.filter((item) => item.status === 'sent');
  const responseTimeMinutes =
    sentItems.length > 0
      ? Math.round(
          sentItems.reduce(
            (total, item) =>
              total + (new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime()),
            0,
          ) /
            sentItems.length /
            60_000,
        )
      : 0;

  const throughputPerDay = sentItems.length;
  const incidentRate =
    queue.length > 0 ? Number(((incidents.length / queue.length) * 100).toFixed(2)) : 0;

  const normalizedIncidents = incidents.filter((incident) => {
    const timeline = getIncidentTimelineInSingleton(incident.id);
    return timeline.some((entry) => entry.state === 'normalized');
  }).length;
  const recoveryRate =
    incidents.length > 0 ? Number(((normalizedIncidents / incidents.length) * 100).toFixed(2)) : 0;

  const cleanerResponded = cleanerPings.filter((ping) => ping.status !== 'requested');
  const cleanerResponseLatencyMinutes =
    cleanerResponded.length > 0
      ? Math.round(
          cleanerResponded.reduce(
            (total, ping) =>
              total + (new Date(ping.updatedAt).getTime() - new Date(ping.createdAt).getTime()),
            0,
          ) /
            cleanerResponded.length /
            60_000,
        )
      : 0;

  return NextResponse.json({
    metrics: {
      responseTimeMinutes,
      throughputPerDay,
      incidentRate,
      recoveryRate,
      refundsAndCompensationUsd: roi.totalRefundAmount,
      reviewOutcomeAverage: Number(roi.reviewAverage.toFixed(2)),
      cleanerResponseLatencyMinutes,
    },
  });
}
