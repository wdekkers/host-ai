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
    title: 'House Rules',
    description: `Review the house rules for ${site.name}.`,
    path: '/house-rules',
  });
}

const defaultRules = [
  {
    title: 'Check-in / Check-out',
    detail: 'Check-in is at 4:00 PM and check-out is at 11:00 AM.',
  },
  {
    title: 'No smoking',
    detail: 'Smoking is not permitted anywhere on the property.',
  },
  {
    title: 'No parties or events',
    detail: 'Parties and events are not allowed at the property.',
  },
  {
    title: 'No pets',
    detail: 'Pets are not allowed unless specified otherwise.',
  },
];

export default async function HouseRulesPage(): Promise<React.ReactNode> {
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
        House Rules
      </h1>
      <p className="mt-4 text-base text-gray-600">
        Please review these guidelines to ensure a smooth and enjoyable stay.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {defaultRules.map((rule) => (
          <section
            key={rule.title}
            className="rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-gray-900">
              {rule.title}
            </h2>
            <p className="mt-2 text-sm text-gray-500">{rule.detail}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
