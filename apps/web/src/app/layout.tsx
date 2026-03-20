import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppChrome } from './app-chrome';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Walt Command Center',
  description: 'AI communication and operations command center.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();

  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="bg-gray-50 text-gray-900">
        <ClerkProvider>
          <AppChrome isAuthenticated={Boolean(userId)}>{children}</AppChrome>
        </ClerkProvider>
      </body>
    </html>
  );
}
