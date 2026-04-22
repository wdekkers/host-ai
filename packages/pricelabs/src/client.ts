import type { z } from 'zod';
import { pricelabsEnv } from './env.js';
import { getJson, postJson } from './http.js';
import { PriceLabsError } from './errors.js';
import {
  ListListingsResponseSchema,
  ListingPricesResponseSchema,
  type Listing,
  type ListingPricesEntry,
} from './schemas.js';

export interface CreatePriceLabsClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface PriceLabsClient {
  listListings(): Promise<Listing[]>;
  getListingPrices(
    listings: { id: string; pms: string }[],
  ): Promise<ListingPricesEntry[]>;
}

export function createPriceLabsClient(
  opts: CreatePriceLabsClientOptions,
): PriceLabsClient {
  if (!opts.apiKey || !opts.apiKey.trim()) {
    throw new Error('createPriceLabsClient: apiKey is required');
  }
  const http = {
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl ?? pricelabsEnv.PRICELABS_BASE_URL,
  };

  function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new PriceLabsError(
        'parse_error',
        'Could not parse PriceLabs response',
        result.error,
      );
    }
    return result.data;
  }

  return {
    async listListings(): Promise<Listing[]> {
      const raw = await getJson<unknown>('/v1/listings', http);
      const parsed = parse(ListListingsResponseSchema, raw);
      return parsed.listings;
    },
    async getListingPrices(
      listings: { id: string; pms: string }[],
    ): Promise<ListingPricesEntry[]> {
      const raw = await postJson<unknown>(
        '/v1/listing_prices',
        { listings },
        http,
      );
      return parse(ListingPricesResponseSchema, raw);
    },
  };
}
