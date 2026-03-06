import { ClerkProvider, UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Walt Command Center',
  description: 'AI communication and operations command center.'
};

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/reservations', label: 'Reservations' },
  { href: '/properties', label: 'Properties' },
  { href: '/questions', label: 'Questions' }
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <ClerkProvider>
          <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="fixed top-0 left-0 h-screen w-56 bg-gray-900 text-white flex flex-col z-50">
              {/* Logo */}
              <div className="px-6 py-5 border-b border-gray-800">
                <span className="text-xl font-semibold tracking-tight">Walt</span>
              </div>

              {/* Nav links */}
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

              {/* User button */}
              <div className="px-5 py-4 border-t border-gray-800">
                <UserButton />
              </div>
            </aside>

            {/* Main content */}
            <main className="ml-56 flex-1 min-h-screen">
              {children}
            </main>
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
