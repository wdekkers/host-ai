import { ClerkProvider, UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Walt Command Center',
  description: 'AI communication and operations command center.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 9999 }}>
            <UserButton />
          </div>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
