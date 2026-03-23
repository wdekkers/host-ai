import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { SiteProvider } from '@/lib/site-context';
import { resolveSiteCached } from '@/lib/resolve-site';
import { buildThemeStyles } from '@/lib/theme';
import { getFontClasses } from '@/lib/fonts';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);
  if (!site) return { title: 'Not Found' };

  return {
    title: { default: site.name, template: `%s | ${site.name}` },
    description: site.description ?? undefined,
    openGraph: {
      type: 'website',
      siteName: site.name,
      images: site.ogImageUrl ? [{ url: site.ogImageUrl }] : undefined,
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  const headersList = await headers();
  const domain = headersList.get('x-site-domain') ?? '';
  const site = await resolveSiteCached(domain);

  if (!site) notFound();

  const themeStyles = buildThemeStyles(site);
  const fontClasses = getFontClasses(site.fontHeading, site.fontBody);

  return (
    <html lang="en" className={fontClasses} style={themeStyles as React.CSSProperties}>
      <body className="min-h-screen antialiased" style={{ fontFamily: 'var(--font-body)' }}>
        <SiteProvider site={site}>
          <SiteHeader />
          {children}
          <SiteFooter />
        </SiteProvider>
      </body>
    </html>
  );
}
