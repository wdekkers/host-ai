import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok', service: 'ops' }));

const defaultPortByService: Record<string, number> = {
  identity: 4101,
  messaging: 4102,
  ops: 4103,
  notifications: 4104
};

const port = Number(process.env.PORT ?? defaultPortByService['ops']);
await app.listen({ port, host: '0.0.0.0' });
