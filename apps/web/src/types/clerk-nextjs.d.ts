declare module '@clerk/nextjs' {
  import type { ReactNode } from 'react';

  export function ClerkProvider(props: { children: ReactNode }): JSX.Element;
  export function SignIn(): JSX.Element;
  export function UserButton(): JSX.Element;

  type UseAuthReturn = {
    getToken: () => Promise<string | null>;
    userId: string | null;
    isSignedIn: boolean;
  };
  export function useAuth(): UseAuthReturn;
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

  type ClerkUser = {
    privateMetadata: Record<string, unknown>;
    publicMetadata: Record<string, unknown>;
  };

  type ClerkClient = {
    users: {
      getUser(userId: string): Promise<ClerkUser>;
    };
  };

  export function auth(): Promise<SessionAuth>;
  export function clerkClient(): Promise<ClerkClient>;
  export function createRouteMatcher(
    patterns: string[],
  ): (request: { nextUrl: { pathname: string } }) => boolean;
  export function clerkMiddleware(
    handler: (
      auth: MiddlewareAuth,
      request: { method: string; url: string; nextUrl: { pathname: string } },
    ) => Promise<Response | void>,
  ): (request: Request) => Promise<Response | void>;
}
