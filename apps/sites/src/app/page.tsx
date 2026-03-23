import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import { resolveSiteCached, getSiteProperties } from '@/lib/resolve-site';
import { getPropertyData, getAmenitiesData, getReviewsData } from '@/lib/data';
import { buildPageMetadata, buildLodgingJsonLd } from '@/lib/seo';
import HeroSection from '@/components/HeroSection';
import PropertyStats from '@/components/PropertyStats';
import ReviewsCarousel from '@/components/ReviewsCarousel';
import LeadForm from '@/components/LeadForm';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  return buildPageMetadata({
    site,
    title: site.name,
    description:
      site.description ??
      site.tagline ??
      `Welcome to ${site.name}`,
    path: '/',
  });
}

export default async function HomePage(): Promise<React.ReactNode> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return null;

  const siteProps = await getSiteProperties(site.id);
  const firstProp = siteProps[0];
  const propertyId = firstProp?.propertyId ?? '';

  const [property, amenities, reviews] = await Promise.all([
    getPropertyData(site.slug, propertyId),
    getAmenitiesData(site.slug),
    getReviewsData(site.slug, site.organizationId),
  ]);

  const jsonLd = buildLodgingJsonLd(site, reviews.length);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <HeroSection site={site} property={property} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-12">
        <PropertyStats property={property} />

        {amenities.length > 0 && (
          <section className="space-y-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <h2
                className="text-3xl font-semibold text-gray-900 sm:text-4xl"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Top amenities
              </h2>
              <p className="max-w-2xl text-sm text-gray-500 sm:text-base">
                Everything you need for a comfortable stay, ready when you arrive.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {amenities.slice(0, 8).map((perk) => (
                <span
                  key={perk.id}
                  className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-gray-900"
                >
                  {perk.label}
                </span>
              ))}
            </div>
            <div className="text-center">
              <Link
                href="/amenities"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 transition hover:text-gray-900"
              >
                See the full amenities list
              </Link>
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <div
            className="overflow-hidden rounded-2xl p-6 text-white shadow-sm"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              Reviews
            </p>
            <h3
              className="mt-3 text-2xl font-semibold"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Hear from our guests.
            </h3>
            <div className="mt-6">
              <ReviewsCarousel reviews={reviews} />
            </div>
            <div className="mt-4 text-center">
              <Link
                href="/reviews"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:text-white"
              >
                Read all reviews
              </Link>
            </div>
          </div>
          <div>
            <LeadForm />
          </div>
        </section>
      </main>
    </>
  );
}
