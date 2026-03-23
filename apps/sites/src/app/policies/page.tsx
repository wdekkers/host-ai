import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { resolveSiteCached } from '@/lib/resolve-site';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  return buildPageMetadata({
    site,
    title: 'Policies',
    description: `Review booking, cancellation, and property policies for ${site.name}.`,
    path: '/policies',
  });
}

const sections = [
  {
    title: 'Cancellation policy',
    items: [
      'Full refund if canceled 30 or more days before check-in.',
      '50% refund if canceled 14-30 days before check-in.',
      'No refund if canceled within 14 days of check-in.',
      'No refunds for early departure.',
      'We recommend travel insurance for unexpected changes.',
    ],
  },
  {
    title: 'House rules',
    items: [
      'Check-in is at 4:00 PM; check-out is at 11:00 AM.',
      'No smoking anywhere on the property.',
      'No parties or events.',
      'No pets allowed unless specified otherwise.',
    ],
  },
];

export default async function PoliciesPage(): Promise<React.ReactNode> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-20 pt-28">
      <h1
        className="text-4xl font-semibold text-gray-900 sm:text-5xl"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Policies
      </h1>
      <p className="mt-4 text-base text-gray-600">
        Please review these policies before booking.
      </p>

      <div className="mt-10 space-y-6">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm"
          >
            <h2
              className="text-2xl font-semibold text-gray-900"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {section.title}
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-gray-500">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
