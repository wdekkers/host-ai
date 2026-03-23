import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import { resolveSiteCached } from '@/lib/resolve-site';
import { getGalleryData } from '@/lib/data';
import { buildPageMetadata } from '@/lib/seo';
import GalleryGrid from '@/components/GalleryGrid';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  return buildPageMetadata({
    site,
    title: 'Photo Gallery',
    description: `Explore the full photo gallery of ${site.name}.`,
    path: '/gallery',
  });
}

export default async function GalleryPage(): Promise<React.ReactNode> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return null;

  const items = await getGalleryData(site.slug);

  const grouped = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  const orderedCategories = Object.keys(grouped);

  return (
    <div className="relative overflow-hidden">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-28">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
              Full Gallery
            </p>
            <h1
              className="mt-3 text-4xl font-semibold text-gray-900 sm:text-5xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Every room, every detail.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-gray-600">
              Browse the complete photo collection for the property.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-900 transition hover:border-gray-900"
          >
            Back to home
          </Link>
        </div>

        {items.length > 0 ? (
          <GalleryGrid items={items} categories={orderedCategories} />
        ) : (
          <p className="text-sm text-gray-500">
            Gallery photos are coming soon.
          </p>
        )}
      </main>
    </div>
  );
}
