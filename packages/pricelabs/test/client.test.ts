import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPriceLabsClient } from '../src/client.js';
import { PriceLabsError } from '../src/errors.js';
import listings from './fixtures/list-listings.json' with { type: 'json' };
import rates from './fixtures/recommended-rates.json' with { type: 'json' };
import settings from './fixtures/settings.json' with { type: 'json' };

describe('PriceLabsClient', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects empty apiKey at construction', () => {
    expect(() => createPriceLabsClient({ apiKey: '' })).toThrow(/apiKey/);
    expect(() => createPriceLabsClient({ apiKey: '   ' })).toThrow(/apiKey/);
  });

  it('listListings parses response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => listings });
    const client = createPriceLabsClient({ apiKey: 'test-key' });
    const result = await client.listListings();
    expect(result.length).toBe(3);
    expect(result[0].id).toBe('pl-abc-123');
  });

  it('getRecommendedRates parses response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => rates });
    const client = createPriceLabsClient({ apiKey: 'test-key' });
    const result = await client.getRecommendedRates('pl-abc-123', '2026-04-21', '2027-04-21');
    expect(result.length).toBe(365);
  });

  it('getSettings parses response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => settings });
    const client = createPriceLabsClient({ apiKey: 'test-key' });
    const result = await client.getSettings('pl-abc-123');
    expect(result.basePrice).toBe(450);
  });

  it('retries on 429 up to 3 times then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => listings });
    const client = createPriceLabsClient({ apiKey: 'test-key' });
    const result = await client.listListings();
    expect(result.length).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws auth_rejected on 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'bad key' }) });
    const client = createPriceLabsClient({ apiKey: 'bad' });
    await expect(client.listListings()).rejects.toMatchObject({
      name: 'PriceLabsError',
      code: 'auth_rejected',
    });
  });

  it('throws rate_limited after max retries on persistent 429', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const client = createPriceLabsClient({ apiKey: 'test-key' });
    await expect(client.listListings()).rejects.toMatchObject({ code: 'rate_limited' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws parse_error on malformed response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ not: 'a listing' }] });
    const client = createPriceLabsClient({ apiKey: 'test-key' });
    await expect(client.listListings()).rejects.toMatchObject({ code: 'parse_error' });
  });
});
