'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useSite } from '@/lib/site-context';

const navLinks = [
  { href: '/about', label: 'About' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/amenities', label: 'Amenities' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export default function SiteHeader(): React.ReactNode {
  const site = useSite();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="absolute left-0 right-0 top-0 z-20 mx-auto flex w-full max-w-6xl items-center gap-6 px-6 pb-6 pt-8 text-white">
        <Link
          href="/"
          className="text-lg font-bold uppercase tracking-[0.4em] sm:text-xl lg:text-2xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {site.name}
        </Link>
        <nav className="hidden flex-1 flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm font-medium text-white/80 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/book"
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition hover:bg-white/90"
            style={{ color: 'var(--color-primary)' }}
          >
            Book now
          </Link>
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 text-white/90 transition hover:border-white hover:text-white md:hidden"
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>
      {menuOpen && (
        <div className="absolute left-0 right-0 top-[88px] z-20 mx-auto w-full max-w-6xl px-6 md:hidden">
          <nav className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/95 px-6 py-5 text-sm font-semibold uppercase tracking-[0.2em] text-gray-800/80 shadow-lg backdrop-blur">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-gray-900"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/book"
              className="transition hover:text-gray-900"
              onClick={() => setMenuOpen(false)}
            >
              Book Now
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
