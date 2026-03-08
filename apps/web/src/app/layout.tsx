import { ClerkProvider, UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Walt Command Center',
  description: 'AI communication and operations command center.',
};

const navLinks = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/reservations', label: 'Reservations' },
  { href: '/properties', label: 'Properties' },
  { href: '/questions', label: 'Questions' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <ClerkProvider>
          {/* Mobile top header */}
          <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-gray-900 text-white flex items-center justify-between px-4 z-50">
            <span className="text-lg font-semibold tracking-tight">Walt</span>
            <UserButton />
          </header>

          <div className="flex min-h-screen">
            {/* Desktop sidebar */}
            <aside className="hidden md:flex fixed top-0 left-0 h-screen w-56 bg-gray-900 text-white flex-col z-50">
              <div className="px-6 py-5 border-b border-gray-800">
                <span className="text-xl font-semibold tracking-tight">Walt</span>
              </div>
              <nav className="flex-1 px-3 py-4 space-y-1">
                {navLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="px-5 py-4 border-t border-gray-800">
                <UserButton />
              </div>
            </aside>

            {/* Main content — top padding for mobile header, bottom padding for mobile nav */}
            <main className="pt-14 md:pt-0 pb-20 md:pb-0 md:ml-56 flex-1 min-h-screen">
              {children}
            </main>
          </div>

          {/* Mobile bottom nav */}
          <nav className="md:hidden fixed bottom-0 inset-x-0 bg-gray-900 border-t border-gray-800 z-50">
            <div className="flex">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex-1 flex items-center justify-center py-3 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </ClerkProvider>
      </body>
    </html>
  );
}
