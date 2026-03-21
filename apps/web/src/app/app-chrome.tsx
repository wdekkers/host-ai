'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';

import { AppSidebar } from './nav-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

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
    <SidebarProvider>
      <AppSidebar
        linkComponent={LinkComponent}
        userButton={<UserButtonComponent />}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-white px-4">
          <SidebarTrigger className="text-slate-400 hover:text-slate-600" />
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-5">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
