import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';

import { navLinks } from '@/lib/nav-links';
import { NavSidebar } from './nav-sidebar';

type NavLinkComponentProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

type UserButtonComponentProps = Record<string, never>;

type AppChromeProps = {
  children: ReactNode;
  isAuthenticated: boolean;
  LinkComponent?: ComponentType<NavLinkComponentProps>;
  UserButtonComponent?: ComponentType<UserButtonComponentProps>;
};

export function AppChrome({
  children,
  isAuthenticated,
  LinkComponent = Link,
  UserButtonComponent = UserButton,
}: AppChromeProps) {
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-gray-900 text-white flex items-center justify-between px-4 z-50">
        <span className="text-lg font-semibold tracking-tight">Walt</span>
        <UserButtonComponent />
      </header>

      <div className="flex min-h-screen">
        <NavSidebar />

        <main className="pt-14 md:pt-0 pb-20 md:pb-0 md:ml-14 flex-1 min-h-screen">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-gray-900 border-t border-gray-800 z-50">
        <div className="flex">
          {navLinks.map(({ href, label }) => (
            <LinkComponent
              key={href}
              href={href}
              className="flex-1 flex items-center justify-center py-3 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {label}
            </LinkComponent>
          ))}
        </div>
      </nav>
    </>
  );
}
