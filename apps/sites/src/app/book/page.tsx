import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { resolveSiteCached } from '@/lib/resolve-site';
import { buildPageMetadata } from '@/lib/seo';
import BookingWidget from '@/components/BookingWidget';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  return buildPageMetadata({
    site,
    title: 'Book Your Stay',
    description: `Check availability and reserve your dates at ${site.name}.`,
    path: '/book',
    noindex: true,
  });
}

export default async function BookPage(): Promise<React.ReactNode> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return null;

  return (
    <div className="relative overflow-hidden">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-20 pt-28">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            Book Now
          </p>
          <h1
            className="mt-3 text-4xl font-semibold text-gray-900 sm:text-5xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Reserve your dates.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-gray-600">
            Send your preferred dates and guest count to confirm availability.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm">
          <BookingWidget height={700} title="Booking widget" />
        </div>
      </main>
    </div>
  );
}
