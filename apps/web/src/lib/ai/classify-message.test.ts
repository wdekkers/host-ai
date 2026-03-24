import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMessage } from './classify-message';

type FakeClassify = (prompt: string) => Promise<string>;

void test('pool/hot tub mention → pool heating suggestion', async () => {
  const fakeAi: FakeClassify = async () =>
    JSON.stringify({
      title: 'Start pool heating before Johnson family arrival',
      description: 'Guest mentioned pool and hot tub use.',
      hasSuggestedTask: true,
    });

  const result = await classifyMessage(
    {
      body: "We're really looking forward to using the pool and hot tub!",
      guestFirstName: 'Johnson family',
      propertyName: 'Palmera',
      arrivalDate: '2026-03-20',
    },
    { callAi: fakeAi },
  );

  assert.ok(result !== null);
  assert.ok(result.title.toLowerCase().includes('pool'));
});

void test('generic message → null', async () => {
  const fakeAi: FakeClassify = async () =>
    JSON.stringify({ hasSuggestedTask: false });

  const result = await classifyMessage(
    {
      body: 'Thank you for the quick reply!',
      guestFirstName: 'Smith',
      propertyName: 'Casa Blanca',
      arrivalDate: '2026-03-21',
    },
    { callAi: fakeAi },
  );

  assert.equal(result, null);
});

void test('early check-in request → check-in suggestion', async () => {
  const fakeAi: FakeClassify = async () =>
    JSON.stringify({
      title: 'Arrange early check-in for Smith',
      description: 'Guest requested early check-in around 11am.',
      hasSuggestedTask: true,
    });

  const result = await classifyMessage(
    {
      body: 'Is it possible to check in early, around 11am?',
      guestFirstName: 'Smith',
      propertyName: 'Casa Blanca',
      arrivalDate: '2026-03-21',
    },
    { callAi: fakeAi },
  );

  assert.ok(result !== null);
  assert.ok(result.title.toLowerCase().includes('check-in'));
});
