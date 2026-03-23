import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { resolveSiteCached } from '@/lib/resolve-site';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);

  const baseUrl = site?.domain
    ? `https://${site.domain}`
    : `https://${site?.slug ?? 'unknown'}.hostpilot.app`;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/book', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
