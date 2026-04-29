import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseTaskDictationWithOpenAi } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, `${name}.json`), 'utf-8'));
}

const fixtureNames = readdirSync(fixturesDir)
  .filter((n) => n.endsWith('.json'))
  .map((n) => n.replace(/\.json$/, ''));

for (const name of fixtureNames) {
  void test(`parseTaskDictationWithOpenAi: ${name} fixture`, async () => {
    const fx = loadFixture(name);
    const stub = async () => JSON.stringify(fx.expected);
    const result = await parseTaskDictationWithOpenAi(
      {
        transcript: fx.transcript,
        today: fx.today,
        properties: fx.properties,
        categories: fx.categories,
      },
      { invokeModel: stub },
    );
    assert.deepEqual(result, fx.expected);
  });
}

void test('parseTaskDictationWithOpenAi: invalid JSON throws', async () => {
  await assert.rejects(
    () =>
      parseTaskDictationWithOpenAi(
        { transcript: 'x', today: '2026-04-28', properties: [], categories: [] },
        { invokeModel: async () => 'not json' },
      ),
    /failed to parse/i,
  );
});

void test('parseTaskDictationWithOpenAi: empty tasks array passes', async () => {
  const result = await parseTaskDictationWithOpenAi(
    { transcript: '', today: '2026-04-28', properties: [], categories: [] },
    { invokeModel: async () => JSON.stringify({ tasks: [] }) },
  );
  assert.deepEqual(result, { tasks: [] });
});

void test('parseTaskDictationWithOpenAi: schema-invalid output throws', async () => {
  await assert.rejects(
    () =>
      parseTaskDictationWithOpenAi(
        { transcript: 'x', today: '2026-04-28', properties: [], categories: [] },
        { invokeModel: async () => JSON.stringify({ tasks: [{ title: '' }] }) },
      ),
    /expected schema/i,
  );
});
