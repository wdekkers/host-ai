import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleTranscribe } from './handler';

void test('returns 400 when audio is missing', async () => {
  const form = new FormData();
  const req = new Request('http://x', { method: 'POST', body: form });
  const res = await handleTranscribe(req);
  assert.equal(res.status, 400);
});

void test('returns 413 when audio is too large', async () => {
  const big = new Uint8Array(26 * 1024 * 1024);
  const form = new FormData();
  form.append('audio', new File([big], 'big.webm', { type: 'audio/webm' }));
  const req = new Request('http://x', { method: 'POST', body: form });
  const res = await handleTranscribe(req);
  assert.equal(res.status, 413);
});
