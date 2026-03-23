import {
  Waves,
  Flame,
  Sparkles,
  ShowerHead,
  Umbrella,
  UtensilsCrossed,
  Gamepad2,
  Tv,
  Wifi,
  Coffee,
  Laptop,
  WashingMachine,
  Baby,
  Car,
  type LucideIcon,
} from 'lucide-react';
import type { Amenity } from '@/lib/data';

/** Map FontAwesome icon names (from JSON) to Lucide components. */
const ICON_MAP: Record<string, LucideIcon> = {
  'fa-swimmer': Waves,
  'fa-hot-tub': Flame,
  'fa-spa': Sparkles,
  'fa-shower': ShowerHead,
  'fa-fire': Flame,
  'fa-umbrella-beach': Umbrella,
  'fa-hamburger': UtensilsCrossed,
  'fa-gamepad': Gamepad2,
  'fa-tv': Tv,
  'fa-wifi': Wifi,
  'fa-utensils': UtensilsCrossed,
  'fa-mug-hot': Coffee,
  'fa-laptop': Laptop,
  'fa-soap': WashingMachine,
  'fa-baby': Baby,
  'fa-car': Car,
};

type AmenitiesListProps = {
  amenities: Amenity[];
};

export default function AmenitiesList({ amenities }: AmenitiesListProps): React.ReactNode {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {amenities.map((amenity) => {
        const Icon = ICON_MAP[amenity.icon] ?? Sparkles;
        return (
          <div
            key={amenity.id}
            className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white/85 p-5 shadow-sm"
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-black text-gray-900 sm:text-xl">
                {amenity.label}
              </p>
              {amenity.detail ? (
                <p className="mt-1 text-sm text-gray-500">{amenity.detail}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
