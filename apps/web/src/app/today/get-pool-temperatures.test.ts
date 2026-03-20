import assert from 'node:assert/strict';
import test from 'node:test';
import { getPoolTemperatures } from './get-pool-temperatures.js';

void test('returns empty array when no pool properties have readings', async () => {
  const result = await getPoolTemperatures('org-1', {
    executeLatestPolls: async () => [],
    executeLastKnown: async () => [],
  });
  assert.deepEqual(result, []);
});

void test('returns null temperatureF and null asOf when all readings are null (pump always off)', async () => {
  const polledAt = new Date('2026-03-19T12:00:00Z');
  const result = await getPoolTemperatures('org-1', {
    executeLatestPolls: async () => [
      { property_id: 'prop-1', property_name: 'Palmera', temperature_f: null, polled_at: polledAt },
    ],
    executeLastKnown: async () => [],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.temperatureF, null);
  assert.equal(result[0]?.asOf, null);
  assert.equal(result[0]?.pumpRunning, false);
});

void test('shows last known temp with asOf when pump is currently off', async () => {
  const lastGoodTime = new Date('2026-03-19T10:00:00Z');
  const latestPollTime = new Date('2026-03-19T13:00:00Z');
  const result = await getPoolTemperatures('org-1', {
    executeLatestPolls: async () => [
      { property_id: 'prop-1', property_name: 'Palmera', temperature_f: null, polled_at: latestPollTime },
    ],
    executeLastKnown: async () => [
      { property_id: 'prop-1', temperature_f: 84, polled_at: lastGoodTime },
    ],
  });
  assert.equal(result[0]?.temperatureF, 84);
  assert.equal(result[0]?.pumpRunning, false);
  assert.deepEqual(result[0]?.asOf, lastGoodTime);
});

void test('shows current temp and pumpRunning=true when pump is on', async () => {
  const now = new Date('2026-03-19T13:00:00Z');
  const result = await getPoolTemperatures('org-1', {
    executeLatestPolls: async () => [
      { property_id: 'prop-1', property_name: 'Casa Bonita', temperature_f: 82, polled_at: now },
    ],
    executeLastKnown: async () => [
      { property_id: 'prop-1', temperature_f: 82, polled_at: now },
    ],
  });
  assert.equal(result[0]?.temperatureF, 82);
  assert.equal(result[0]?.pumpRunning, true);
  assert.deepEqual(result[0]?.asOf, now);
});
