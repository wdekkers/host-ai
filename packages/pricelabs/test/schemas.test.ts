import { describe, it, expect } from 'vitest';
import {
  ListListingsResponseSchema,
  ListingPricesEntrySchema,
  ListingPricesResponseSchema,
  ListingPricesSuccessSchema,
  ListingPricesErrorSchema,
} from '../src/schemas.js';
import listings from './fixtures/list-listings.json' with { type: 'json' };
import listingPrices from './fixtures/listing-prices.json' with { type: 'json' };

describe('PriceLabs schemas', () => {
  it('parses list-listings fixture and unwraps listings', () => {
    const parsed = ListListingsResponseSchema.parse(listings);
    expect(parsed.listings.length).toBe(3);
    expect(parsed.listings[0]).toMatchObject({
      id: 'pl-sample-1',
      pms: 'airbnb',
      name: 'Sample Frisco Home',
    });
    // passthrough keeps unknown fields
    expect((parsed.listings[0] as Record<string, unknown>).no_of_bedrooms).toBe(4);
  });

  it('parses listing-prices fixture — both success and error entries', () => {
    const parsed = ListingPricesResponseSchema.parse(listingPrices);
    expect(parsed.length).toBe(2);

    const first = parsed[0];
    const success = ListingPricesSuccessSchema.parse(first);
    expect(success.data.length).toBe(3);
    expect(success.data[0]!.price).toBe(250);
    expect(success.data[1]!.user_price).toBe(-1);
    expect(success.data[2]!.booking_status).toBe('Booked');

    const second = parsed[1];
    const error = ListingPricesErrorSchema.parse(second);
    expect(error.error_status).toBe('LISTING_TOGGLE_OFF');
  });

  it('entry union accepts either success or error shape', () => {
    const okEntry = {
      id: 'pl-1',
      pms: 'airbnb',
      data: [{ date: '2026-04-21', price: 300 }],
    };
    expect(ListingPricesEntrySchema.safeParse(okEntry).success).toBe(true);

    const errEntry = { id: 'pl-2', pms: 'smartbnb', error: 'oops' };
    expect(ListingPricesEntrySchema.safeParse(errEntry).success).toBe(true);
  });

  it('rejects malformed shape', () => {
    expect(() => ListingPricesResponseSchema.parse({ not: 'array' })).toThrow();
    expect(() =>
      ListListingsResponseSchema.parse([{ id: 'x', pms: 'y', name: 'z' }]),
    ).toThrow();
  });
});
