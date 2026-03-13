import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMessagingApp } from '../index.js';

/** Minimal mock DB that satisfies the opt-in and opt-out route queries. */
function makeMockDb() {
  return {
    insert: () => ({
      values: (row: unknown) => {
        void row;
        // Plain `await db.insert().values()` (used for consent, audit, log inserts)
        // Upsert chain: .values().onConflictDoUpdate().returning()
        const result = Promise.resolve(undefined) as unknown as Promise<undefined> & {
          onConflictDoUpdate: () => { returning: () => Promise<{ id: string }[]> };
        };
        result.onConflictDoUpdate = () => ({
          returning: () => Promise.resolve([{ id: 'mock-vendor-id' }]),
        });
        return result;
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  } as never;
}

void test('POST /consent/opt-in: returns 400 when phone invalid', async () => {
  const app = buildMessagingApp({ db: makeMockDb(), skipTwilio: true });
  const res = await app.inject({
    method: 'POST',
    url: '/consent/opt-in',
    payload: {
      contactName: 'Jane Doe',
      phone: 'notaphone',
      checkboxChecked: true,
      sourceUrl: 'http://localhost:3000/sms/opt-in',
    },
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});

void test('POST /consent/opt-in: returns 400 when checkbox not checked', async () => {
  const app = buildMessagingApp({ db: makeMockDb(), skipTwilio: true });
  const res = await app.inject({
    method: 'POST',
    url: '/consent/opt-in',
    payload: {
      contactName: 'Jane Doe',
      phone: '+15551234567',
      checkboxChecked: false,
      sourceUrl: 'http://localhost:3000/sms/opt-in',
    },
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});

void test('POST /consent/opt-in: returns 200 with valid input', async () => {
  const app = buildMessagingApp({ db: makeMockDb(), skipTwilio: true });
  const res = await app.inject({
    method: 'POST',
    url: '/consent/opt-in',
    payload: {
      contactName: 'Jane Doe',
      companyName: 'Acme Cleaners',
      phone: '+15551234567',
      checkboxChecked: true,
      sourceUrl: 'http://localhost:3000/sms/opt-in',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { vendorId: string };
  assert.ok(body.vendorId);
  await app.close();
});
