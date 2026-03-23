import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { resolveSiteCached } from '@/lib/resolve-site';

const routes = [
  '/',
  '/about',
  '/amenities',
  '/gallery',
  '/reviews',
  '/faq',
  '/house-rules',
  '/policies',
  '/contact',
  '/blog',
  '/events',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);

  const baseUrl = site?.domain
    ? `https://${site.domain}`
    : `https://${site?.slug ?? 'unknown'}.hostpilot.app`;

  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: (route === '/' ? 'weekly' : 'monthly') as 'weekly' | 'monthly',
    priority: route === '/' ? 1 : 0.7,
  }));
}
