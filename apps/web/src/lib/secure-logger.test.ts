import assert from 'node:assert/strict';
import test from 'node:test';

import { handleApiError, redactForLogs } from './secure-logger';

void test('redacts sensitive fields and pii for logs', () => {
  const payload = {
    guestEmail: 'jane.doe@example.com',
    guestPhone: '+1 (415) 555-1212',
    token: 'secret-token-value',
    nested: {
      authorization: 'Bearer top-secret',
      note: 'Reach me at support@example.com or +1 212 555 9988'
    }
  };

  const redacted = redactForLogs(payload) as Record<string, unknown>;
  const nested = redacted.nested as Record<string, unknown>;

  assert.equal(String(redacted.guestEmail).includes('jane.doe@example.com'), false);
  assert.equal(String(redacted.guestPhone).includes('555-1212'), false);
  assert.equal(redacted.token, '[REDACTED]');
  assert.equal(nested.authorization, '[REDACTED]');
  assert.equal(String(nested.note).includes('support@example.com'), false);
});

void test('api error handler logs masked context and returns safe response', async () => {
  const captured: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    captured.push(args.map((arg) => String(arg)).join(' '));
  };

  try {
    const response = handleApiError({
      route: '/api/test',
      error: new Error('Validation failed for jane.doe@example.com'),
      context: {
        email: 'jane.doe@example.com',
        phone: '+1 (415) 555-1212',
        authorization: 'Bearer token'
      }
    });
    const body = (await response.json()) as { error: string };
    assert.equal(response.status, 400);
    assert.equal(body.error.includes('jane.doe@example.com'), false);

    const joined = captured.join('\n');
    assert.equal(joined.includes('jane.doe@example.com'), false);
    assert.equal(joined.includes('555-1212'), false);
    assert.equal(joined.includes('Bearer token'), false);
    assert.equal(joined.includes('"route":"/api/test"'), true);
  } finally {
    console.error = originalError;
  }
});
