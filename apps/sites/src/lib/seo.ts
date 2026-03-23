import type { Metadata } from 'next';
import type { SiteConfig } from '@walt/contracts';

type BuildPageMetadataInput = {
  site: SiteConfig;
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
};

export function buildPageMetadata({
  site,
  title,
  description,
  path,
  noindex,
}: BuildPageMetadataInput): Metadata {
  const baseUrl = site.domain
    ? `https://${site.domain}`
    : `https://${site.slug}.hostpilot.app`;
  const url = `${baseUrl}${path}`;
  const imageUrl = site.ogImageUrl ?? undefined;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: site.name,
      images: imageUrl ? [{ url: imageUrl, alt: title }] : undefined,
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

export function buildLodgingJsonLd(
  site: SiteConfig,
  reviewCount: number,
): Record<string, unknown> {
  const baseUrl = site.domain
    ? `https://${site.domain}`
    : `https://${site.slug}.hostpilot.app`;

  const aggregateRating =
    reviewCount > 0
      ? {
          '@type': 'AggregateRating',
          ratingValue: 5,
          reviewCount,
        }
      : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: site.name,
    url: baseUrl,
    description: site.description ?? site.tagline ?? '',
    image: site.ogImageUrl ? [site.ogImageUrl] : [],
    ...(aggregateRating ? { aggregateRating } : {}),
  };
}
