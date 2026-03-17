import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';

import { navLinks } from '@/lib/nav-links';

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
        <aside className="hidden md:flex fixed top-0 left-0 h-screen w-56 bg-gray-900 text-white flex-col z-50">
          <div className="px-6 py-5 border-b border-gray-800">
            <span className="text-xl font-semibold tracking-tight">Walt</span>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navLinks.map(({ href, label }) => (
              <LinkComponent
                key={href}
                href={href}
                className="flex items-center px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                {label}
              </LinkComponent>
            ))}
          </nav>
          <div className="px-5 py-4 border-t border-gray-800">
            <UserButtonComponent />
          </div>
        </aside>

        <main className="pt-14 md:pt-0 pb-20 md:pb-0 md:ml-56 flex-1 min-h-screen">{children}</main>
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
