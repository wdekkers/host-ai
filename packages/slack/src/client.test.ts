import assert from 'node:assert/strict';
import test from 'node:test';

import { SlackClient } from './client.js';

void test('SlackClient.postMessage sends to correct channel', async () => {
  let capturedBody: Record<string, unknown> | undefined;

  const mockFetch = async (_url: string, opts: { body: string }) => {
    capturedBody = JSON.parse(opts.body) as Record<string, unknown>;
    return { ok: true, json: async () => ({ ok: true }) } as Response;
  };

  const client = new SlackClient({ token: 'xoxb-test', fetch: mockFetch as never });

  await client.postMessage('#urgent', 'Guest complaint at Beach House');

  assert.equal(capturedBody?.channel, '#urgent');
  assert.equal(capturedBody?.text, 'Guest complaint at Beach House');
});

void test('SlackClient.postMessage throws on Slack API error', async () => {
  const mockFetch = async () =>
    ({ ok: true, json: async () => ({ ok: false, error: 'channel_not_found' }) }) as Response;

  const client = new SlackClient({ token: 'xoxb-test', fetch: mockFetch as never });

  await assert.rejects(
    () => client.postMessage('#nonexistent', 'test'),
    /channel_not_found/,
  );
});
