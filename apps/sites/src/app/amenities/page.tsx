import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import { resolveSiteCached } from '@/lib/resolve-site';
import { getAmenitiesData } from '@/lib/data';
import { buildPageMetadata } from '@/lib/seo';
import AmenitiesList from '@/components/AmenitiesList';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  return buildPageMetadata({
    site,
    title: 'Amenities and Features',
    description: `See everything included at ${site.name}.`,
    path: '/amenities',
  });
}

export default async function AmenitiesPage(): Promise<React.ReactNode> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return null;

  const amenities = await getAmenitiesData(site.slug);

  return (
    <div className="relative overflow-hidden">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-28">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
              Amenities
            </p>
            <h1
              className="mt-3 text-4xl font-semibold text-gray-900 sm:text-5xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Everything is ready when you arrive.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-gray-600">
              Enjoy all the comforts and conveniences of the property.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-900 transition hover:border-gray-900"
          >
            Back to home
          </Link>
        </div>

        {amenities.length > 0 ? (
          <AmenitiesList amenities={amenities} />
        ) : (
          <p className="text-sm text-gray-500">
            Amenity details are coming soon.
          </p>
        )}
      </main>
    </div>
  );
}
