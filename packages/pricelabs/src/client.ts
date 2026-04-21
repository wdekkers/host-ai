import type { z } from 'zod';
import { pricelabsEnv } from './env.js';
import { getJson } from './http.js';
import { PriceLabsError } from './errors.js';
import {
  ListingSchema,
  DailyRateSchema,
  ListingSettingsSchema,
  type Listing,
  type DailyRate,
  type ListingSettings,
} from './schemas.js';

export interface CreatePriceLabsClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface PriceLabsClient {
  listListings(): Promise<Listing[]>;
  getRecommendedRates(listingId: string, startDate: string, endDate: string): Promise<DailyRate[]>;
  getSettings(listingId: string): Promise<ListingSettings>;
}

export function createPriceLabsClient(opts: CreatePriceLabsClientOptions): PriceLabsClient {
  if (!opts.apiKey || !opts.apiKey.trim()) {
    throw new Error('createPriceLabsClient: apiKey is required');
  }
  const http = { apiKey: opts.apiKey, baseUrl: opts.baseUrl ?? pricelabsEnv.PRICELABS_BASE_URL };

  function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new PriceLabsError('parse_error', 'Could not parse PriceLabs response', result.error);
    }
    return result.data;
  }

  return {
    async listListings(): Promise<Listing[]> {
      const raw = await getJson<unknown>('/v1/listings', http);
      return parse(ListingSchema.array(), raw);
    },
    async getRecommendedRates(listingId, startDate, endDate): Promise<DailyRate[]> {
      const raw = await getJson<unknown>(
        `/v1/listings/${encodeURIComponent(listingId)}/recommended_prices?start=${startDate}&end=${endDate}`,
        http,
      );
      return parse(DailyRateSchema.array(), raw);
    },
    async getSettings(listingId): Promise<ListingSettings> {
      const raw = await getJson<unknown>(`/v1/listings/${encodeURIComponent(listingId)}/settings`, http);
      return parse(ListingSettingsSchema, raw);
    },
  };
}
