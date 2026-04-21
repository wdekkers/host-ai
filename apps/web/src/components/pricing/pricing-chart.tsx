'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import type { DailySnapshot } from '@/hooks/use-pricing-snapshots';

type BookedBand = { startDate: string; endDate: string };

function bookedBands(days: DailySnapshot[]): BookedBand[] {
  const bands: BookedBand[] = [];
  let start: string | null = null;
  let prev: string | null = null;
  for (const d of days) {
    if (d.isBooked) {
      if (start === null) start = d.date;
      prev = d.date;
    } else if (start !== null && prev !== null) {
      bands.push({ startDate: start, endDate: prev });
      start = null;
      prev = null;
    }
  }
  if (start !== null && prev !== null) bands.push({ startDate: start, endDate: prev });
  return bands;
}

function fmtDollars(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

export function PricingChart({
  days,
  lastSyncedAt,
}: {
  days: DailySnapshot[];
  lastSyncedAt: string | null;
}): React.ReactElement {
  const bands = bookedBands(days);
  const formattedDays = days.map((d) => ({
    ...d,
    recommendedDollars: d.recommendedPrice / 100,
    publishedDollars: d.publishedPrice != null ? d.publishedPrice / 100 : null,
  }));

  return (
    <div className="w-full">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedDays} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            {bands.map((b, i) => (
              <ReferenceArea
                key={i}
                x1={b.startDate}
                x2={b.endDate}
                fill="#e2e8f0"
                fillOpacity={0.6}
                ifOverflow="extendDomain"
              />
            ))}
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(value: string) => {
                const d = new Date(value);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
              interval={6}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
            <Tooltip
              formatter={(value, name) => [
                typeof value === 'number' ? fmtDollars(value * 100) : value,
                name === 'recommendedDollars' ? 'Recommended' : 'Published',
              ]}
              labelFormatter={(label) =>
                new Date(String(label)).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })
              }
            />
            <Line type="monotone" dataKey="recommendedDollars" stroke="#0284c7" strokeWidth={2} dot={false} />
            <Line
              type="monotone"
              dataKey="publishedDollars"
              stroke="#334155"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 text-xs text-slate-500 mt-2">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-sky-600" /> Recommended
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-slate-700" /> Published
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-slate-200" /> Booked
        </div>
        {lastSyncedAt && (
          <div className="ml-auto">
            Last synced:{' '}
            {new Date(lastSyncedAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
            })}
          </div>
        )}
      </div>
    </div>
  );
}
