import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { resolveSiteCached } from '@/lib/resolve-site';
import { getReviewsData } from '@/lib/data';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  return buildPageMetadata({
    site,
    title: 'Guest Reviews',
    description: `Read what guests are saying about their stays at ${site.name}.`,
    path: '/reviews',
  });
}

export default async function ReviewsPage(): Promise<React.ReactNode> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return null;

  const reviews = await getReviewsData(site.slug);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-28">
      <section className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">
          Guest reviews
        </p>
        <h1
          className="text-3xl font-semibold text-gray-900 sm:text-4xl lg:text-5xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          What guests loved about their stay
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-gray-500 sm:text-base">
          Real experiences from guests who stayed at {site.name}.
        </p>
      </section>

      {reviews.length === 0 ? (
        <section className="rounded-2xl border border-gray-200 bg-white/90 p-6 text-center shadow-sm">
          <p className="text-sm text-gray-500">
            Reviews are coming soon.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {reviews.map((review, index) => (
            <article
              key={`${review.name}-${review.date}-${index}`}
              className="rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-gray-900">
                  {review.name}
                </p>
                {review.location && (
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                    {review.location}
                  </p>
                )}
              </div>
              {review.date && (
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-gray-400">
                  {review.date}
                </p>
              )}
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                {review.text}
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
