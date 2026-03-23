import { z } from 'zod';

// ── Enums ──

export const bookingStatusSchema = z.enum([
  'pending',
  'awaiting_approval',
  'confirmed',
  'cancelled',
  'declined',
  'payment_failed',
  'refunded',
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

// ── Payment Intent ──

export const createPaymentIntentRequestSchema = z.object({
  siteId: z.string().min(1),
  propertyId: z.string().min(1),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guestEmail: z.string().email(),
  totalAmountCents: z.number().int().positive(),
});
export type CreatePaymentIntentRequest = z.infer<typeof createPaymentIntentRequestSchema>;

export const createPaymentIntentResponseSchema = z.object({
  clientSecret: z.string(),
  paymentIntentId: z.string(),
  holdId: z.string(),
  expiresAt: z.string().datetime(),
});
export type CreatePaymentIntentResponse = z.infer<typeof createPaymentIntentResponseSchema>;

// ── Booking Request ──

export const createBookingRequestSchema = z.object({
  siteId: z.string().min(1),
  paymentIntentId: z.string().min(1),
  propertyId: z.string().min(1),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  totalAmountCents: z.number().int().positive(),
});
export type CreateBookingRequest = z.infer<typeof createBookingRequestSchema>;

export const bookingResponseSchema = z.object({
  bookingId: z.string().uuid(),
  status: bookingStatusSchema,
  hospitableBookingId: z.string().optional(),
});
export type BookingResponse = z.infer<typeof bookingResponseSchema>;

// ── Booking Detail ──

export const bookingDetailSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string(),
  hospitableBookingId: z.string().nullable(),
  propertyId: z.string(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guestName: z.string(),
  guestEmail: z.string(),
  guestPhone: z.string().nullable(),
  totalAmountCents: z.number().int(),
  paymentIntentId: z.string(),
  status: bookingStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BookingDetail = z.infer<typeof bookingDetailSchema>;
