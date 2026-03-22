import Stripe from "stripe";

export type CreatePaymentIntentOptions = {
  amountCents: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  metadata?: Record<string, string>;
  description?: string;
};

export type PaymentIntentResult = {
  ok: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  error?: string;
};

export type CaptureResult = {
  ok: boolean;
  paymentIntentId?: string;
  status?: string;
  error?: string;
};

export type CancelResult = {
  ok: boolean;
  paymentIntentId?: string;
  status?: string;
  error?: string;
};

export type WebhookVerifyResult = {
  ok: boolean;
  event?: Stripe.Event;
  error?: string;
};

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

export async function createManualCapturePaymentIntent(
  stripe: Stripe,
  options: CreatePaymentIntentOptions
): Promise<PaymentIntentResult> {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: options.amountCents,
      currency: options.currency.toLowerCase(),
      capture_method: "manual",
      receipt_email: options.customerEmail,
      description: options.description,
      metadata: {
        customer_name: options.customerName,
        customer_email: options.customerEmail,
        ...options.metadata,
      },
    });

    return {
      ok: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ?? undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function capturePayment(
  stripe: Stripe,
  paymentIntentId: string
): Promise<CaptureResult> {
  try {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    return {
      ok: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function cancelPayment(
  stripe: Stripe,
  paymentIntentId: string
): Promise<CancelResult> {
  try {
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    return {
      ok: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function verifyWebhookSignature(
  stripe: Stripe,
  payload: string | Buffer,
  signature: string,
  secret: string
): WebhookVerifyResult {
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, secret);
    return { ok: true, event };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getPaymentIntent(
  stripe: Stripe,
  paymentIntentId: string
): Promise<{ ok: boolean; paymentIntent?: Stripe.PaymentIntent; error?: string }> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return { ok: true, paymentIntent };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export { Stripe };
