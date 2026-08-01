import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { createBillingPortalSession, createCheckoutSession, ensureStripeCustomer } from "../services/billing.js";

export const billingRouter = Router();
billingRouter.use(requireAuth);

billingRouter.get("/plans", async (_req, res) => {
  const result = await pool.query(
    "SELECT id, name, price_cents, currency, storage_limit_bytes, features, sort_order FROM subscription_plans ORDER BY sort_order ASC"
  );
  res.json({ plans: result.rows });
});

billingRouter.get("/subscription", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT u.account_type, u.subscription_status, u.subscription_expires_at, u.stripe_customer_id,
            p.name AS plan_name, p.price_cents, p.storage_limit_bytes, p.features
     FROM users u JOIN subscription_plans p ON p.id = u.account_type
     WHERE u.id = $1`,
    [req.userId]
  );
  res.json({ subscription: result.rows[0] ?? null });
});

const checkoutSchema = z.object({
  planId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

billingRouter.post("/checkout-session", async (req: AuthedRequest, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const planResult = await pool.query("SELECT * FROM subscription_plans WHERE id = $1", [parsed.data.planId]);
  const plan = planResult.rows[0];
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  if (!plan.stripe_price_id) {
    return res.status(400).json({ error: "This plan has no Stripe price configured (e.g. the free plan)" });
  }

  const userResult = await pool.query("SELECT email, stripe_customer_id FROM users WHERE id = $1", [
    req.userId,
  ]);
  const user = userResult.rows[0];

  try {
    const customerId = await ensureStripeCustomer(req.userId!, user.email, user.stripe_customer_id);
    if (customerId !== user.stripe_customer_id) {
      await pool.query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customerId, req.userId]);
    }

    const session = await createCheckoutSession({
      customerId,
      priceId: plan.stripe_price_id,
      successUrl: parsed.data.successUrl,
      cancelUrl: parsed.data.cancelUrl,
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    res.status(502).json({ error: "Failed to create checkout session", detail: (err as Error).message });
  }
});

const portalSchema = z.object({ returnUrl: z.string().url() });

billingRouter.post("/portal-session", async (req: AuthedRequest, res) => {
  const parsed = portalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userResult = await pool.query("SELECT stripe_customer_id FROM users WHERE id = $1", [req.userId]);
  const customerId = userResult.rows[0]?.stripe_customer_id;
  if (!customerId) return res.status(400).json({ error: "No billing account on file yet" });

  try {
    const session = await createBillingPortalSession(customerId, parsed.data.returnUrl);
    res.json({ portalUrl: session.url });
  } catch (err) {
    res.status(502).json({ error: "Failed to create billing portal session", detail: (err as Error).message });
  }
});
