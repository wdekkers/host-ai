import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { bookings } from "@walt/db";
import { releaseHoldByPaymentIntent } from "../services/holds.js";
import { getSiteConfigWithStripe } from "../services/site-config.js";
import { verifyWebhookSignature, capturePayment, cancelPayment } from "@walt/stripe";

export const registerWebhooksRoutes = async (app: FastifyInstance): Promise<void> => {
  // Stripe webhook - needs raw body
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => {
      done(null, body);
    }
  );

  // POST /v1/webhooks/stripe/:siteId
  app.post<{ Params: { siteId: string } }>(
    "/v1/webhooks/stripe/:siteId",
    async (request, reply) => {
      const { siteId } = request.params;
      const signature = request.headers["stripe-signature"] as string;

      if (!signature) {
        return reply.code(400).send({ error: "Missing stripe-signature header" });
      }

      const siteData = await getSiteConfigWithStripe(siteId);
      if (!siteData) {
        return reply.code(404).send({ error: "Site not found" });
      }

      const { config, stripe } = siteData;
      const rawBody = request.body as Buffer;

      const verifyResult = verifyWebhookSignature(
        stripe,
        rawBody,
        signature,
        config.stripeWebhookSecret
      );

      if (!verifyResult.ok || !verifyResult.event) {
        app.log.error({ error: verifyResult.error }, "Webhook signature verification failed");
        return reply.code(400).send({ error: "Invalid signature" });
      }

      const event = verifyResult.event;
      app.log.info({ type: event.type, id: event.id }, "Processing Stripe webhook");

      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object;
          await db
            .update(bookings)
            .set({ status: "confirmed", updatedAt: new Date() })
            .where(eq(bookings.paymentIntentId, paymentIntent.id));
          await releaseHoldByPaymentIntent(paymentIntent.id);
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object;
          await db
            .update(bookings)
            .set({ status: "payment_failed", updatedAt: new Date() })
            .where(eq(bookings.paymentIntentId, paymentIntent.id));
          await releaseHoldByPaymentIntent(paymentIntent.id);
          break;
        }

        case "payment_intent.canceled": {
          const paymentIntent = event.data.object;
          await db
            .update(bookings)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(bookings.paymentIntentId, paymentIntent.id));
          await releaseHoldByPaymentIntent(paymentIntent.id);
          break;
        }

        default:
          app.log.info({ type: event.type }, "Unhandled webhook event type");
      }

      return { received: true };
    }
  );

  // POST /v1/webhooks/hospitable/:siteId
  app.post<{ Params: { siteId: string } }>(
    "/v1/webhooks/hospitable/:siteId",
    async (request, reply) => {
      const { siteId } = request.params;
      const body = request.body as Record<string, unknown>;

      const siteData = await getSiteConfigWithStripe(siteId);
      if (!siteData) {
        return reply.code(404).send({ error: "Site not found" });
      }

      const { stripe } = siteData;
      const eventType = body.event as string;
      const bookingId = body.booking_id as string;

      app.log.info({ eventType, bookingId }, "Processing Hospitable webhook");

      if (!bookingId) {
        return reply.code(400).send({ error: "Missing booking_id" });
      }

      // Find booking by Hospitable ID
      const [booking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.hospitableBookingId, bookingId))
        .limit(1);

      if (!booking) {
        app.log.warn({ bookingId }, "Booking not found for Hospitable webhook");
        return { received: true };
      }

      switch (eventType) {
        case "booking.approved": {
          // Capture the payment
          const captureResult = await capturePayment(stripe, booking.paymentIntentId);
          if (captureResult.ok) {
            await db
              .update(bookings)
              .set({ status: "confirmed", updatedAt: new Date() })
              .where(eq(bookings.id, booking.id));
          } else {
            app.log.error({ error: captureResult.error }, "Failed to capture payment on approval");
          }
          break;
        }

        case "booking.declined": {
          // Cancel the payment hold
          const cancelResult = await cancelPayment(stripe, booking.paymentIntentId);
          if (cancelResult.ok) {
            await db
              .update(bookings)
              .set({ status: "declined", updatedAt: new Date() })
              .where(eq(bookings.id, booking.id));
          } else {
            app.log.error({ error: cancelResult.error }, "Failed to cancel payment on decline");
          }
          await releaseHoldByPaymentIntent(booking.paymentIntentId);
          break;
        }

        case "booking.cancelled": {
          await db
            .update(bookings)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(bookings.id, booking.id));
          break;
        }

        default:
          app.log.info({ eventType }, "Unhandled Hospitable webhook event");
      }

      return { received: true };
    }
  );
};
