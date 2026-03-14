import type { FastifyRequest } from 'fastify';

export function requirePermission(permission: string) {
  return async (request: FastifyRequest) => {
    if (!request.auth) {
      const error = new Error('Unauthorized') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    const permissions = new Set(request.auth.permissions);
    if (!permissions.has(permission)) {
      const error = new Error('Forbidden') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }
  };
}
