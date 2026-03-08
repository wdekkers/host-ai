import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMessagingApp } from '../index.js';

function makeMockDb(
  vendor: { id: string; status: string } | null = { id: 'v1', status: 'active' },
) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(vendor ? [vendor] : []),
          orderBy: () => ({
            limit: () => Promise.resolve([{ id: 'c1', consentStatus: 'opted_in' }]),
          }),
        }),
      }),
    }),
    insert: () => ({
      values: () => Promise.resolve(),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  } as never;
}

void test('POST /webhooks/inbound: returns TwiML for STOP keyword', async () => {
  const app = buildMessagingApp({
    db: makeMockDb(),
    skipTwilio: true,
    skipSignatureValidation: true,
  });
  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/inbound',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'From=%2B15551234567&To=%2B15559999999&Body=STOP',
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.headers['content-type']?.includes('text/xml'));
  await app.close();
});

void test('POST /webhooks/inbound: returns HELP TwiML reply', async () => {
  const app = buildMessagingApp({
    db: makeMockDb(),
    skipTwilio: true,
    skipSignatureValidation: true,
  });
  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/inbound',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'From=%2B15551234567&To=%2B15559999999&Body=HELP',
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.includes('WALT Services'));
  await app.close();
});

void test('POST /webhooks/inbound: stores non-keyword messages and returns empty TwiML', async () => {
  const app = buildMessagingApp({
    db: makeMockDb(),
    skipTwilio: true,
    skipSignatureValidation: true,
  });
  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/inbound',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'From=%2B15551234567&To=%2B15559999999&Body=I+will+be+there+at+10am',
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.headers['content-type']?.includes('text/xml'));
  await app.close();
});
