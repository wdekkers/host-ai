import type { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    requirePermission: (permission: string) => (request: FastifyRequest) => Promise<void>;
  }
}

export const authorizePlugin: FastifyPluginAsync = async (app) => {
  app.decorate('requirePermission', (permission: string) => {
    return async (request) => {
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
  });
};
