import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { bookings } from "@walt/db";
import { getSiteConfigWithStripe } from "../services/site-config.js";
import { createInventoryHold, hasConflictingHold } from "../services/holds.js";
import { checkAvailability, createBooking as createHospitableBooking } from "../services/hospitable.js";
import { createManualCapturePaymentIntent, cancelPayment } from "@walt/stripe";

interface PaymentIntentBody {
  siteId: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guestEmail: string;
  totalAmountCents: number;
}

interface BookingRequestBody {
  siteId: string;
  paymentIntentId: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  totalAmountCents: number;
}

interface BookingIdParams {
  id: string;
}

export const registerBookingsRoutes = async (app: FastifyInstance): Promise<void> => {
  // POST /v1/bookings/payment-intent
  app.post<{ Body: PaymentIntentBody }>(
    "/v1/bookings/payment-intent",
    async (request, reply) => {
      const { siteId, propertyId, checkIn, checkOut, guestEmail, totalAmountCents } = request.body;

      if (!siteId || !propertyId || !checkIn || !checkOut || !guestEmail || !totalAmountCents) {
        return reply.code(400).send({ error: "Missing required fields" });
      }

      const siteData = await getSiteConfigWithStripe(siteId);
      if (!siteData) {
        return reply.code(404).send({ error: "Site not found" });
      }

      const { config, stripe } = siteData;
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      // Check for conflicting holds
      const hasConflict = await hasConflictingHold(siteId, propertyId, checkInDate, checkOutDate);
      if (hasConflict) {
        return reply.code(409).send({ error: "Dates are currently held by another booking" });
      }

      // Check Hospitable availability
      const availability = await checkAvailability(config.hospitableApiKey, propertyId, checkIn, checkOut);
      if (!availability.ok || !availability.available) {
        return reply.code(409).send({ error: "Dates are not available" });
      }

      // Create Stripe payment intent
      const paymentResult = await createManualCapturePaymentIntent(stripe, {
        amountCents: totalAmountCents,
        currency: "USD",
        customerEmail: guestEmail,
        customerName: guestEmail, // Will be updated in booking request
        description: `Booking: ${propertyId} ${checkIn} to ${checkOut}`,
        metadata: {
          site_id: siteId,
          property_id: propertyId,
          check_in: checkIn,
          check_out: checkOut,
        },
      });

      if (!paymentResult.ok || !paymentResult.clientSecret) {
        app.log.error({ error: paymentResult.error }, "Failed to create payment intent");
        return reply.code(500).send({ error: "Failed to create payment" });
      }

      // Create inventory hold
      const hold = await createInventoryHold({
        siteId,
        propertyId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        paymentIntentId: paymentResult.paymentIntentId,
        holdDurationMinutes: config.holdDurationMinutes,
      });

      return {
        clientSecret: paymentResult.clientSecret,
        paymentIntentId: paymentResult.paymentIntentId,
        holdId: hold.id,
        expiresAt: hold.expiresAt,
      };
    }
  );

  // POST /v1/bookings/request
  app.post<{ Body: BookingRequestBody }>(
    "/v1/bookings/request",
    async (request, reply) => {
      const {
        siteId,
        paymentIntentId,
        propertyId,
        checkIn,
        checkOut,
        guestName,
        guestEmail,
        guestPhone,
        totalAmountCents,
      } = request.body;

      if (!siteId || !paymentIntentId || !propertyId || !guestName || !guestEmail) {
        return reply.code(400).send({ error: "Missing required fields" });
      }

      const siteData = await getSiteConfigWithStripe(siteId);
      if (!siteData) {
        return reply.code(404).send({ error: "Site not found" });
      }

      const { config } = siteData;

      // Create booking record
      const [booking] = await db
        .insert(bookings)
        .values({
          siteId,
          propertyId,
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          guestName,
          guestEmail,
          guestPhone,
          totalAmountCents,
          paymentIntentId,
          status: "pending",
        })
        .returning();

      if (!booking) {
        return reply.code(500).send({ error: "Failed to create booking record" });
      }

      // Create booking in Hospitable
      const hospitableResult = await createHospitableBooking(config.hospitableApiKey, {
        propertyId,
        checkIn,
        checkOut,
        guestName,
        guestEmail,
        guestPhone,
        totalAmountCents,
      });

      if (!hospitableResult.ok) {
        app.log.error({ error: hospitableResult.error }, "Failed to create Hospitable booking");
        // Don't fail - the booking request is created, Hospitable booking can be retried
      }

      // Update booking with Hospitable ID if available
      if (hospitableResult.bookingId) {
        await db
          .update(bookings)
          .set({
            hospitableBookingId: hospitableResult.bookingId,
            status: "awaiting_approval",
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, booking.id));
      }

      return {
        bookingId: booking.id,
        status: hospitableResult.bookingId ? "awaiting_approval" : "pending",
        hospitableBookingId: hospitableResult.bookingId,
      };
    }
  );

  // GET /v1/bookings/:id
  app.get<{ Params: BookingIdParams }>(
    "/v1/bookings/:id",
    async (request, reply) => {
      const { id } = request.params;

      const [booking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, id))
        .limit(1);

      if (!booking) {
        return reply.code(404).send({ error: "Booking not found" });
      }

      return { booking };
    }
  );

  // POST /v1/bookings/:id/cancel
  app.post<{ Params: BookingIdParams }>(
    "/v1/bookings/:id/cancel",
    async (request, reply) => {
      const { id } = request.params;

      const [booking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, id))
        .limit(1);

      if (!booking) {
        return reply.code(404).send({ error: "Booking not found" });
      }

      if (booking.status === "cancelled" || booking.status === "refunded") {
        return reply.code(400).send({ error: "Booking is already cancelled" });
      }

      const siteData = await getSiteConfigWithStripe(booking.siteId);
      if (!siteData) {
        return reply.code(500).send({ error: "Site configuration error" });
      }

      const { stripe } = siteData;

      // Cancel/refund the payment
      const cancelResult = await cancelPayment(stripe, booking.paymentIntentId);
      if (!cancelResult.ok) {
        app.log.error({ error: cancelResult.error }, "Failed to cancel payment");
        return reply.code(500).send({ error: "Failed to cancel payment" });
      }

      // Update booking status
      await db
        .update(bookings)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, id));

      return { status: "cancelled" };
    }
  );
};
