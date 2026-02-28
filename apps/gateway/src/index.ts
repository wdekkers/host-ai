import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serviceHealthResponseSchema } from '@walt/contracts';
import { zodToJsonSchema } from 'zod-to-json-schema';

const app = Fastify({ logger: true });

await app.register(swagger, {
  openapi: {
    info: {
      title: 'Walt Gateway API',
      version: '0.1.0'
    }
  }
});

await app.register(swaggerUi, { routePrefix: '/docs' });

app.get(
  '/health',
  {
    schema: {
      tags: ['system'],
      response: {
        200: zodToJsonSchema(serviceHealthResponseSchema, 'ServiceHealthResponse')
      }
    }
  },
  async () => ({ status: 'ok', service: 'gateway' })
);

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
