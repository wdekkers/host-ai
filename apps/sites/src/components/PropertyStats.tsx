import { Bed, Bath, Users } from 'lucide-react';
import type { PropertyData } from '@/lib/data';

type PropertyStatsProps = {
  property: PropertyData;
};

const stats = [
  {
    key: 'bedrooms' as const,
    label: 'Bedrooms',
    subtitle: 'Designed for restful, hotel-style sleep.',
    Icon: Bed,
  },
  {
    key: 'bathrooms' as const,
    label: 'Bathrooms',
    subtitle: 'Fresh linens, toiletries, and towels.',
    Icon: Bath,
  },
  {
    key: 'sleeps' as const,
    label: 'Guests',
    subtitle: 'Room to spread out and unwind.',
    Icon: Users,
  },
];

export default function PropertyStats({ property }: PropertyStatsProps): React.ReactNode {
  return (
    <section className="grid gap-6 rounded-xl border border-gray-200 bg-white/80 px-6 py-8 shadow-sm md:grid-cols-3">
      {stats.map(({ key, label, subtitle, Icon }) => (
        <div key={key} className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Icon className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-base font-black uppercase tracking-[0.32em] text-gray-900">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {property[key] ?? '-'}
            </p>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
