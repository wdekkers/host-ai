import { ClerkProvider } from '@clerk/nextjs';
import { auth, clerkClient } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { roleSchema } from '@walt/contracts';
import type { Role } from '@walt/contracts';
import { AppChrome } from './app-chrome';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'Walt Command Center',
  description: 'AI communication and operations command center.',
};

async function getUserRole(userId: string): Promise<Role> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const roleCandidate = (user.privateMetadata as Record<string, unknown>).role;
    const parsed = roleSchema.safeParse(roleCandidate);
    return parsed.success ? parsed.data : 'owner';
  } catch {
    return 'owner';
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  const role = userId ? await getUserRole(userId) : 'viewer';

  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body className="bg-gray-50 text-gray-900">
        <ClerkProvider>
          <AppChrome isAuthenticated={Boolean(userId)} role={role}>{children}</AppChrome>
        </ClerkProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
