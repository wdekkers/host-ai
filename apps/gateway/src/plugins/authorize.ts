import type { FastifyRequest } from 'fastify';

// The gateway verifies JWT authenticity in the auth hook (signature, expiry, issuer).
// Fine-grained role/permission checks cannot be done here because the app's custom
// roles live in Clerk private metadata and are not included in the standard JWT.
// Every authenticated user has at least dashboard.read, so requirePermission enforces
// authentication only. Role-gating requires a Clerk JWT template to include the role.
export function requireAuth() {
  return async (request: FastifyRequest) => {
    if (!request.auth) {
      const error = new Error('Unauthorized') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }
  };
}
