import { Router, raw } from "express";
import Stripe from "stripe";
import { pool } from "../db/pool.js";
import { verifyWebhookSignature } from "../services/billing.js";

export const billingWebhookRouter = Router();

const PLAN_BY_PRICE_ID_CACHE = new Map<string, string>();

async function planIdForPrice(priceId: string): Promise<string | null> {
  if (PLAN_BY_PRICE_ID_CACHE.has(priceId)) return PLAN_BY_PRICE_ID_CACHE.get(priceId)!;
  const result = await pool.query("SELECT id FROM subscription_plans WHERE stripe_price_id = $1", [priceId]);
  const planId = result.rows[0]?.id ?? null;
  if (planId) PLAN_BY_PRICE_ID_CACHE.set(priceId, planId);
  return planId;
}

billingWebhookRouter.post("/", raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(req.body as Buffer, signature);
  } catch (err) {
    return res.status(400).json({ error: "Invalid webhook signature", detail: (err as Error).message });
  }

  const existing = await pool.query("SELECT id FROM billing_events WHERE stripe_event_id = $1", [event.id]);
  if (existing.rowCount) {
    return res.status(200).json({ received: true, deduped: true });
  }

  try {
    await handleEvent(event);
  } finally {
    await pool.query(
      `INSERT INTO billing_events (stripe_event_id, event_type, payload) VALUES ($1,$2,$3)
       ON CONFLICT (stripe_event_id) DO NOTHING`,
      [event.id, event.type, JSON.stringify(event.data.object)]
    );
  }

  res.status(200).json({ received: true });
});

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id;
      const planId = priceId ? await planIdForPrice(priceId) : null;
      const status = sub.status === "active" || sub.status === "trialing" ? "active" : sub.status;
      const currentPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;

      await pool.query(
        `UPDATE users SET
           account_type = COALESCE($1, account_type),
           subscription_status = $2,
           subscription_expires_at = to_timestamp($3),
           stripe_subscription_id = $4
         WHERE stripe_customer_id = $5`,
        [planId, status, currentPeriodEnd ?? null, sub.id, sub.customer as string]
      );
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await pool.query(
        `UPDATE users SET account_type = 'free', subscription_status = 'cancelled', stripe_subscription_id = NULL
         WHERE stripe_customer_id = $1`,
        [sub.customer as string]
      );
      break;
    }
    default:
      break;
  }
}
