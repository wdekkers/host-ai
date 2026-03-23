import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { resolveSiteCached, getSiteProperties } from '@/lib/resolve-site';
import { getFaqData } from '@/lib/data';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  return buildPageMetadata({
    site,
    title: 'Frequently Asked Questions',
    description: `Get quick answers about booking, amenities, and what to expect at ${site.name}.`,
    path: '/faq',
  });
}

export default async function FaqPage(): Promise<React.ReactNode> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return null;

  const siteProps = await getSiteProperties(site.id);
  const propertyId = siteProps[0]?.propertyId ?? '';
  const faqs = await getFaqData(propertyId);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-20 pt-28">
      <h1
        className="text-4xl font-semibold text-gray-900 sm:text-5xl"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Frequently Asked Questions
      </h1>

      {faqs.length === 0 ? (
        <p className="mt-10 text-sm text-gray-500">
          FAQ content is coming soon. Contact us if you have questions.
        </p>
      ) : (
        <div className="mt-10 space-y-4">
          {faqs.map((faq, index) => (
            <details
              key={faq.question}
              open={index === 0}
              className="group rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-gray-900">
                <span>{faq.question}</span>
                <span className="text-gray-400 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600">
                <p>{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}
