import { describe, it, expect } from 'vitest';
import { ListingSchema, DailyRateSchema, ListingSettingsSchema } from '../src/schemas.js';
import listings from './fixtures/list-listings.json' with { type: 'json' };
import rates from './fixtures/recommended-rates.json' with { type: 'json' };
import settings from './fixtures/settings.json' with { type: 'json' };

describe('PriceLabs schemas', () => {
  it('parses list-listings fixture', () => {
    const parsed = ListingSchema.array().parse(listings);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0]).toMatchObject({ id: expect.any(String), name: expect.any(String) });
  });

  it('parses recommended-rates fixture', () => {
    const parsed = DailyRateSchema.array().parse(rates);
    expect(parsed.length).toBe(365);
    expect(parsed[0].recommendedPrice).toBeTypeOf('number');
  });

  it('parses settings fixture', () => {
    const parsed = ListingSettingsSchema.parse(settings);
    expect(parsed.basePrice).toBeTypeOf('number');
  });

  it('rejects unknown shape', () => {
    expect(() => DailyRateSchema.parse({ foo: 'bar' })).toThrow();
  });
});
