import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import { resolveSiteCached } from '@/lib/resolve-site';
import { buildPageMetadata } from '@/lib/seo';
import LeadForm from '@/components/LeadForm';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  return buildPageMetadata({
    site,
    title: 'Contact and Availability',
    description: `Share your dates and guest details to check availability at ${site.name}.`,
    path: '/contact',
  });
}

export default async function ContactPage(): Promise<React.ReactNode> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return null;

  return (
    <div className="relative overflow-hidden">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-28">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
              Contact Us
            </p>
            <h1
              className="mt-3 text-4xl font-semibold text-gray-900 sm:text-5xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Let&apos;s plan your stay.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-gray-600">
              Share your dates, guest count, and questions.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-900 transition hover:border-gray-900"
          >
            Back to home
          </Link>
        </div>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm">
            <h2
              className="text-2xl font-semibold text-gray-900"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              What to include
            </h2>
            <div className="mt-4 space-y-3 text-sm text-gray-500">
              <p>Preferred dates and length of stay</p>
              <p>Number of adults and children</p>
              <p>Any special requests or questions</p>
            </div>
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">
              We reply within 24 hours.
            </div>
          </div>
          <LeadForm />
        </section>
      </main>
    </div>
  );
}
