import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

export async function ensureStripeCustomer(userId: string, email: string, existingCustomerId: string | null) {
  if (existingCustomerId) return existingCustomerId;
  const stripe = getStripeClient();
  const customer = await stripe.customers.create({ email, metadata: { userId } });
  return customer.id;
}

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
}

export async function createBillingPortalSession(customerId: string, returnUrl: string) {
  const stripe = getStripeClient();
  return stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): Stripe.Event {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}
