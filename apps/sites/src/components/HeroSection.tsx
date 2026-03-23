import type { SiteConfig } from '@walt/contracts';
import type { PropertyData } from '@/lib/data';
import Link from 'next/link';

type HeroSectionProps = {
  site: SiteConfig;
  property: PropertyData;
};

export default function HeroSection({ site, property }: HeroSectionProps): React.ReactNode {
  const tagline = property.tagline ?? site.tagline ?? site.description ?? '';

  return (
    <section className="relative w-full min-h-[420px] overflow-hidden border-b border-gray-200 text-white sm:min-h-[520px] lg:min-h-[620px]">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'var(--color-primary)' }}
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 pb-16 pt-36 sm:pt-40 lg:pt-44">
        <h1
          className="w-full text-5xl font-bold sm:text-6xl lg:text-7xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {site.name}
        </h1>
        <p className="w-full max-w-2xl text-lg text-white/85 sm:text-xl">
          {tagline}
        </p>
        <div className="flex flex-wrap gap-4 pt-2">
          <Link
            href="/book"
            className="rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-lg transition hover:-translate-y-0.5"
            style={{ backgroundColor: 'var(--color-accent, var(--color-primary))' }}
          >
            Book now
          </Link>
          <Link
            href="/gallery"
            className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/10"
          >
            View gallery
          </Link>
        </div>
      </div>
    </section>
  );
}
