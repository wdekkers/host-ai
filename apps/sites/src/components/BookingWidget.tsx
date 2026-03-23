'use client';

import { useSite } from '@/lib/site-context';

type BookingWidgetProps = {
  className?: string;
  height?: number;
  title?: string;
};

export default function BookingWidget({
  className = '',
  height = 800,
  title = 'Booking widget',
}: BookingWidgetProps): React.ReactNode {
  const site = useSite();

  return (
    <div className={className} style={{ width: '100%' }}>
      <div
        className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-gray-200 bg-white/80 px-6 py-8 text-center"
        style={{ height }}
        aria-label={title}
      >
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-400">
            Booking
          </p>
          <p className="text-sm text-gray-500">
            Email us your dates and guest count to confirm availability.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Contact {site.name}
          </a>
        </div>
      </div>
    </div>
  );
}
