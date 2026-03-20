import assert from 'node:assert/strict';
import test from 'node:test';
import { readTemperature, clearSessionCache, type FetchFn } from './iaqualink.js';

const MOCK_CREDS = {
  AccessKeyId: 'AKIATEST',
  SecretKey: 'secret',
  SessionToken: 'session-token',
};

// Helper: creates a mock fetch that returns responses in sequence
function mockFetch(responses: Array<{ status: number; body: unknown }>): FetchFn {
  let i = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return async (_url: string, _init?: RequestInit): Promise<Response> => {
    const r = responses[i++] ?? { status: 200, body: {} };
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
    } as Response;
  };
}

test.beforeEach(() => clearSessionCache());

void test('returns temperature when pump is running', async () => {
  const fetchFn = mockFetch([
    { status: 200, body: { credentials: MOCK_CREDS } },
    { status: 200, body: { reported: { state: { pool_temp: 84 } } } },
  ]);
  const result = await readTemperature('device-123', { fetchFn });
  assert.equal(result.temperatureF, 84);
  assert.equal(result.deviceSerial, 'device-123');
  assert.ok(result.polledAt instanceof Date);
});

void test('returns null temperature when pump is off (pool_temp absent)', async () => {
  const fetchFn = mockFetch([
    { status: 200, body: { credentials: MOCK_CREDS } },
    { status: 200, body: { reported: { state: {} } } },
  ]);
  const result = await readTemperature('device-123', { fetchFn });
  assert.equal(result.temperatureF, null);
});

void test('re-authenticates on 401 and retries shadow request', async () => {
  let authCalls = 0;
  const responses: Array<{ status: number; body: unknown }> = [
    { status: 200, body: { credentials: MOCK_CREDS } },
    { status: 401, body: {} },
    { status: 200, body: { credentials: MOCK_CREDS } },
    { status: 200, body: { reported: { state: { pool_temp: 78 } } } },
  ];
  let i = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchFn: FetchFn = async (url: string, _init?: RequestInit): Promise<Response> => {
    if (url.includes('/login')) authCalls++;
    const r = responses[i++] ?? { status: 200, body: {} };
    return { ok: r.status < 300, status: r.status, json: async () => r.body } as Response;
  };
  const result = await readTemperature('device-abc', { fetchFn });
  assert.equal(authCalls, 2);
  assert.equal(result.temperatureF, 78);
});

void test('caches session — authenticates only once across multiple reads', async () => {
  let authCalls = 0;
  const fetchFn: FetchFn = async (url: string): Promise<Response> => {
    if (url.includes('/login')) {
      authCalls++;
      return { ok: true, status: 200, json: async () => ({ credentials: MOCK_CREDS }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ reported: { state: { pool_temp: 80 } } }) } as Response;
  };
  await readTemperature('d1', { fetchFn });
  await readTemperature('d2', { fetchFn });
  assert.equal(authCalls, 1);
});
