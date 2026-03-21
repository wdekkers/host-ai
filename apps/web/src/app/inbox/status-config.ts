import type React from 'react';
import { HelpCircle, Clock, CheckCircle, XCircle } from 'lucide-react';

export const STATUS_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  inquiry: { label: 'Inquiry', className: 'bg-sky-100 text-sky-700 border-0' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-0' },
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700 border-0' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-0' },
};

export const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  inquiry: HelpCircle,
  pending: Clock,
  confirmed: CheckCircle,
  cancelled: XCircle,
};

export const STATUS_COLORS: Record<string, string> = {
  inquiry: 'text-sky-600',
  pending: 'text-amber-500',
  confirmed: 'text-green-600',
  cancelled: 'text-red-600',
};
