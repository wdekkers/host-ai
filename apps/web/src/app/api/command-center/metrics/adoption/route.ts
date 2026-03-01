import { NextResponse } from 'next/server';

import { getRiskTrustIndicator, listAuditTimelineInSingleton, listQueue } from '@/lib/command-center-store';

export async function GET() {
  const queue = listQueue();
  const audits = listAuditTimelineInSingleton();

  const commandCenterActions = audits.filter((entry) => ['approved', 'edited', 'sent', 'rejected'].includes(entry.action)).length;
  const commandCenterFirstRate =
    queue.length > 0 ? Number(Math.min(100, (commandCenterActions / Math.max(1, queue.length)) * 100).toFixed(2)) : 0;

  const highRiskPending = queue.filter((item) => {
    const risk = getRiskTrustIndicator({ intent: item.intent, body: item.body }).risk;
    return (item.status === 'pending' || item.status === 'edited') && risk === 'high';
  }).length;

  const reducedAnxietyIndex =
    queue.length > 0 ? Number(Math.max(0, 100 - (highRiskPending / queue.length) * 100).toFixed(2)) : 100;

  const workflowAdoptionRate =
    queue.length > 0
      ? Number(((queue.filter((item) => item.status === 'approved' || item.status === 'sent').length / queue.length) * 100).toFixed(2))
      : 0;

  return NextResponse.json({
    adoption: {
      commandCenterFirstRate,
      reducedAnxietyIndex,
      workflowAdoptionRate,
      period: 'rolling-30d'
    }
  });
}
