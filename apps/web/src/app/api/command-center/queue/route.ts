import { NextResponse } from 'next/server';

import { getRiskTrustIndicator, listQueue } from '@/lib/command-center-store';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const intent = url.searchParams.get('intent');
  const risk = url.searchParams.get('risk');
  const trust = url.searchParams.get('trust');
  const sort = url.searchParams.get('sort');
  const includeUx = url.searchParams.get('includeUx') === '1';

  const filtered = listQueue()
    .filter((item) => !intent || item.intent === intent)
    .filter(
      (item) =>
        !risk || getRiskTrustIndicator({ intent: item.intent, body: item.body }).risk === risk,
    )
    .filter(
      (item) =>
        !trust || getRiskTrustIndicator({ intent: item.intent, body: item.body }).trust === trust,
    );

  const sorted = [...filtered];
  if (sort === 'sla') {
    const score = (item: (typeof sorted)[number]) => {
      const riskTrust = getRiskTrustIndicator({ intent: item.intent, body: item.body });
      const riskScore = riskTrust.risk === 'high' ? 300 : riskTrust.risk === 'medium' ? 180 : 80;
      const ageMinutes = Math.max(0, (Date.now() - new Date(item.createdAt).getTime()) / 60_000);
      const ageScore = Math.min(120, Math.floor(ageMinutes / 10));
      const statusScore = item.status === 'pending' || item.status === 'edited' ? 40 : 0;
      return riskScore + ageScore + statusScore;
    };
    sorted.sort((left, right) => score(right) - score(left));
  }

  const items = includeUx
    ? sorted.map((item) => {
        const riskTrust = getRiskTrustIndicator({ intent: item.intent, body: item.body });
        const ageHours = Math.max(0, (Date.now() - new Date(item.createdAt).getTime()) / 3_600_000);
        const slaBucket = ageHours >= 12 ? 'breach-risk' : ageHours >= 4 ? 'warning' : 'healthy';
        return {
          ...item,
          risk: riskTrust.risk,
          trust: riskTrust.trust,
          slaBucket,
          quickActions: ['preview', 'edit', 'send'],
        };
      })
    : sorted;

  return NextResponse.json({ items });
}
