declare module '@clerk/nextjs' {
  import type { ReactNode } from 'react';

  export function ClerkProvider(props: { children: ReactNode }): JSX.Element;
  export function SignIn(): JSX.Element;
}

declare module '@clerk/nextjs/server' {
  type SessionAuth = {
    userId: string | null;
    orgId: string | null;
    sessionClaims: unknown;
  };

  type MiddlewareAuth = (() => Promise<SessionAuth>) & {
    protect: () => Promise<void>;
  };

  export function auth(): Promise<SessionAuth>;
  export function createRouteMatcher(patterns: string[]): (request: { nextUrl: { pathname: string } }) => boolean;
  export function clerkMiddleware(
    handler: (auth: MiddlewareAuth, request: { method: string; url: string; nextUrl: { pathname: string } }) => Promise<Response | void>
  ): (request: Request) => Promise<Response | void>;
}
