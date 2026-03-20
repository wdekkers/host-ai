import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePollPoolTemps } from './handler.js';

const makeRequest = (secret = 'test-secret') =>
  new Request('http://localhost/api/cron/poll-pool-temps', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });

void test('returns 401 with wrong secret', async () => {
  const res = await handlePollPoolTemps(makeRequest('wrong'), { cronSecret: 'test-secret' });
  assert.equal(res.status, 401);
});

void test('polls each pool property and inserts a reading', async () => {
  const insertedRows: unknown[] = [];
  const res = await handlePollPoolTemps(makeRequest(), {
    cronSecret: 'test-secret',
    getPoolProperties: async () => [
      { id: 'prop-1', name: 'Palmera', iaqualinkDeviceSerial: 'SN-ABC' },
      { id: 'prop-2', name: 'Casa Bonita', iaqualinkDeviceSerial: 'SN-DEF' },
    ],
    readTemperature: async (serial) => ({ deviceSerial: serial, temperatureF: 82, polledAt: new Date() }),
    insertReading: async (row) => { insertedRows.push(row); },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; polled: number };
  assert.equal(body.polled, 2);
  assert.equal(insertedRows.length, 2);
});

void test('inserts null temperature when pump is off', async () => {
  const insertedRows: Array<{ temperatureF: number | null }> = [];
  await handlePollPoolTemps(makeRequest(), {
    cronSecret: 'test-secret',
    getPoolProperties: async () => [
      { id: 'prop-1', name: 'Palmera', iaqualinkDeviceSerial: 'SN-ABC' },
    ],
    readTemperature: async (serial) => ({ deviceSerial: serial, temperatureF: null, polledAt: new Date() }),
    insertReading: async (row) => { insertedRows.push(row as { temperatureF: number | null }); },
  });
  assert.equal(insertedRows[0]?.temperatureF, null);
});

void test('continues polling other properties when one throws', async () => {
  const insertedRows: unknown[] = [];
  const res = await handlePollPoolTemps(makeRequest(), {
    cronSecret: 'test-secret',
    getPoolProperties: async () => [
      { id: 'prop-1', name: 'Palmera', iaqualinkDeviceSerial: 'SN-ABC' },
      { id: 'prop-2', name: 'Casa Bonita', iaqualinkDeviceSerial: 'SN-DEF' },
    ],
    readTemperature: async (serial) => {
      if (serial === 'SN-ABC') throw new Error('API timeout');
      return { deviceSerial: serial, temperatureF: 78, polledAt: new Date() };
    },
    insertReading: async (row) => { insertedRows.push(row); },
  });
  const body = (await res.json()) as { ok: boolean; polled: number };
  assert.equal(body.polled, 1);
  assert.equal(insertedRows.length, 1);
});
