import { z } from 'zod';

// GET /v1/listings — one listing.
// The real API returns many fields (lat/lng, market occupancy, etc.) — we only
// require the handful we actually use. Use `.passthrough()` so unknown fields
// (which vary between PMS source types) don't break parsing.
export const ListingSchema = z
  .object({
    id: z.string().min(1),
    pms: z.string().min(1),
    name: z.string().min(1),
    push_enabled: z.boolean().optional(),
    isHidden: z.boolean().optional(),
    min: z.number().int().nullable().optional(),
    base: z.number().int().nullable().optional(),
    max: z.number().int().nullable().optional(),
    city_name: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
  })
  .passthrough();
export type Listing = z.infer<typeof ListingSchema>;

// GET /v1/listings — response wrapper `{ listings: [...] }`.
export const ListListingsResponseSchema = z.object({
  listings: z.array(ListingSchema),
});
export type ListListingsResponse = z.infer<typeof ListListingsResponseSchema>;

// POST /v1/listing_prices — one date row within a listing's `data` array.
// `user_price === -1` is the sentinel for "no host override"; `booking_status`
// is `""` for available, any other string (`"Booked"`, `"Booked (Check-In)"`)
// means booked. All prices are integer dollars at this boundary.
export const RateEntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    price: z.number(),
    user_price: z.number().optional(),
    uncustomized_price: z.number().optional(),
    min_stay: z.number().int().nullable().optional(),
    booking_status: z.string().optional(),
    check_in: z.boolean().optional(),
    check_out: z.boolean().optional(),
  })
  .passthrough();
export type RateEntry = z.infer<typeof RateEntrySchema>;

// POST /v1/listing_prices — one listing's success entry.
export const ListingPricesSuccessSchema = z.object({
  id: z.string().min(1),
  pms: z.string().min(1),
  group: z.string().nullable().optional(),
  currency: z.string().optional(),
  last_refreshed_at: z.string().optional(),
  data: z.array(RateEntrySchema),
});
export type ListingPricesSuccess = z.infer<typeof ListingPricesSuccessSchema>;

// POST /v1/listing_prices — one listing's error entry
// (e.g. `{ error_status: "LISTING_TOGGLE_OFF" }`).
export const ListingPricesErrorSchema = z.object({
  id: z.string().min(1),
  pms: z.string().min(1),
  error: z.string(),
  error_status: z.string().optional(),
});
export type ListingPricesError = z.infer<typeof ListingPricesErrorSchema>;

// Per-listing entry is either a success row (has `data`) or an error row.
// Using z.union rather than discriminatedUnion because the common discriminator
// field (`data` vs `error`) is not literal-equal across variants.
export const ListingPricesEntrySchema = z.union([
  ListingPricesSuccessSchema,
  ListingPricesErrorSchema,
]);
export type ListingPricesEntry = z.infer<typeof ListingPricesEntrySchema>;

// POST /v1/listing_prices — the response is a bare array of entries.
export const ListingPricesResponseSchema = z.array(ListingPricesEntrySchema);
export type ListingPricesResponse = z.infer<typeof ListingPricesResponseSchema>;
