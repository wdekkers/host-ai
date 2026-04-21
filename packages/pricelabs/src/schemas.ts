import { z } from 'zod';

export const ListingSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().nullable().optional(),
  active: z.boolean().optional().default(true),
});
export type Listing = z.infer<typeof ListingSchema>;

export const DailyRateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ISO date YYYY-MM-DD'),
  recommendedPrice: z.number().int().nonnegative(),
  publishedPrice: z.number().int().nonnegative().nullable().optional(),
  basePrice: z.number().int().nonnegative(),
  minPrice: z.number().int().nonnegative(),
  maxPrice: z.number().int().nonnegative(),
  minStay: z.number().int().positive().nullable().optional(),
  closedToArrival: z.boolean().optional().default(false),
  closedToDeparture: z.boolean().optional().default(false),
});
export type DailyRate = z.infer<typeof DailyRateSchema>;

export const ListingSettingsSchema = z.object({
  listingId: z.string().min(1),
  basePrice: z.number().int().nonnegative(),
  minPrice: z.number().int().nonnegative(),
  maxPrice: z.number().int().nonnegative(),
  lastMinuteDiscount: z.unknown().optional(),
  orphanGapRules: z.unknown().optional(),
  seasonalProfile: z.string().nullable().optional(),
  raw: z.record(z.unknown()).optional(),
});
export type ListingSettings = z.infer<typeof ListingSettingsSchema>;
