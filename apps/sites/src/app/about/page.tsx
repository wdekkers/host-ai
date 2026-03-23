import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import { resolveSiteCached } from '@/lib/resolve-site';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  return buildPageMetadata({
    site,
    title: `About ${site.name}`,
    description: `Learn about ${site.name} and what makes it special.`,
    path: '/about',
  });
}

export default async function AboutPage(): Promise<React.ReactNode> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return null;

  return (
    <div className="relative overflow-hidden bg-white text-gray-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-20 pt-28">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
              About Us
            </p>
            <h1
              className="mt-3 text-4xl font-semibold text-gray-900 sm:text-5xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              The story behind {site.name}.
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-900 transition hover:border-gray-900"
          >
            Back to home
          </Link>
        </div>

        <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2
            className="text-2xl font-semibold text-gray-900"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            A retreat made to unwind
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            {site.description ??
              `${site.name} was designed for relaxed, elevated stays with the amenities that matter most. Whether you're visiting for a family trip, a weekend getaway, or a special occasion, we've created a space that feels like home while going above and beyond.`}
          </p>
        </section>

        <section
          className="space-y-4 rounded-2xl p-6 text-white shadow-sm"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <h2
            className="text-2xl font-semibold"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Our commitment
          </h2>
          <p className="text-sm leading-relaxed text-white/85">
            We take pride in every detail of the guest experience. From the
            moment you book to checkout, we are available to answer questions
            and ensure everything runs smoothly.
          </p>
        </section>
      </main>
    </div>
  );
}
