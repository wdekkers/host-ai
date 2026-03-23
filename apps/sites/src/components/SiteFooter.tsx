'use client';

import Link from 'next/link';
import { useSite } from '@/lib/site-context';
import NewsletterForm from './NewsletterForm';

const footerLinks = [
  { href: '/gallery', label: 'Gallery' },
  { href: '/amenities', label: 'Amenities' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/faq', label: 'FAQ' },
  { href: '/policies', label: 'Policies' },
  { href: '/contact', label: 'Contact' },
];

export default function SiteFooter(): React.ReactNode {
  const site = useSite();
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-20 border-t border-gray-200 text-white"
      style={{ backgroundColor: 'var(--color-primary)' }}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            Newsletter + Discounts
          </p>
          <h2
            className="text-3xl font-semibold"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Stay in the loop.
          </h2>
          <p className="text-sm text-white/80">
            Be first to hear about seasonal discounts, open dates, and new
            upgrades.
          </p>
          <NewsletterForm />
        </div>
        <div className="grid gap-6 text-sm text-white/80 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white">
              Explore
            </p>
            <div className="flex flex-col gap-2">
              {footerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white">
              Contact
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/book" className="transition hover:text-white">
                Book now
              </Link>
              <span>{site.name}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-white/60 sm:flex-row sm:items-center">
          <span>
            &copy; {year} {site.name}. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
