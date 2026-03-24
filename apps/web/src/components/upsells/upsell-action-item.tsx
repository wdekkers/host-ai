'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

type UpsellActionItemProps = {
  upsell: {
    id: string;
    upsellType: string;
    status: string;
    estimatedRevenue: number | null;
    offeredAt: string;
    respondedAt: string | null;
    guestFirstName: string | null;
    guestLastName: string | null;
    propertyName: string | null;
  };
  onConfirm: (id: string) => void;
};

function formatUpsellType(type: string): string {
  switch (type) {
    case 'gap_night':
      return 'gap night';
    case 'early_checkin':
      return 'early check-in';
    case 'late_checkout':
      return 'late check-out';
    default:
      return type.replace(/_/g, ' ');
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function UpsellActionItem({ upsell, onConfirm }: UpsellActionItemProps): React.JSX.Element {
  const guestName =
    upsell.guestFirstName || upsell.guestLastName
      ? [upsell.guestFirstName, upsell.guestLastName].filter(Boolean).join(' ')
      : 'Unknown Guest';

  const upsellTypeLabel = formatUpsellType(upsell.upsellType);
  const acceptedAt = upsell.respondedAt ?? upsell.offeredAt;

  const revenueDisplay =
    upsell.estimatedRevenue != null
      ? `$${upsell.estimatedRevenue} estimated revenue`
      : 'Revenue not specified';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50">
        <Check className="h-4 w-4 text-green-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">
          {guestName} accepted {upsellTypeLabel}
        </p>
        <p className="text-xs text-slate-500">
          {upsell.propertyName ? `${upsell.propertyName} · ` : ''}{revenueDisplay}
        </p>
        <p className="text-xs text-slate-400">Accepted {timeAgo(acceptedAt)} ago</p>
      </div>
      <Button size="sm" onClick={() => onConfirm(upsell.id)}>
        Confirm &amp; Log Revenue
      </Button>
    </div>
  );
}
