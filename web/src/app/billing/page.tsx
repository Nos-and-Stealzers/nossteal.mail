"use client";

import { useEffect, useState } from "react";
import { api, type SubscriptionPlan, type Subscription } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

export default function BillingPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.listPlans(), api.getSubscription()])
      .then(([p, s]) => {
        setPlans(p.plans);
        setSubscription(s.subscription);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  async function handleUpgrade(planId: string) {
    setError(null);
    setBusyPlan(planId);
    try {
      const { checkoutUrl } = await api.createCheckoutSession(
        planId,
        `${window.location.origin}/billing?success=1`,
        `${window.location.origin}/billing`
      );
      window.location.href = checkoutUrl;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyPlan(null);
    }
  }

  async function handleManageBilling() {
    setError(null);
    setPortalBusy(true);
    try {
      const { portalUrl } = await api.createPortalSession(`${window.location.origin}/billing`);
      window.location.href = portalUrl;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPortalBusy(false);
    }
  }

  return (
    <AppShell title="Billing" maxWidth="46rem">
      {subscription && (
        <div className="card card-pad mb-6 flex items-center justify-between">
          <div>
            <p className="font-medium">
              {subscription.plan_name} <span className="badge badge-accent ml-1">{subscription.subscription_status}</span>
            </p>
            {subscription.subscription_expires_at && (
              <p className="mt-1 text-xs subtle">Renews / expires {new Date(subscription.subscription_expires_at).toLocaleDateString()}</p>
            )}
          </div>
          {subscription.stripe_customer_id && (
            <button onClick={handleManageBilling} disabled={portalBusy} className="btn btn-secondary btn-sm">
              {portalBusy ? "Opening…" : "Manage billing"}
            </button>
          )}
        </div>
      )}

      {error && <p className="alert alert-danger mb-6">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => {
          const current = subscription?.account_type === plan.id;
          return (
            <div key={plan.id} className="card card-pad flex flex-col" style={current ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" } : undefined}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{plan.name}</p>
                {current && <span className="badge badge-accent">Current</span>}
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                ${(plan.price_cents / 100).toFixed(0)}
                <span className="text-sm font-normal subtle">/mo</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm muted">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span style={{ color: "var(--accent)" }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={busyPlan === plan.id || current || plan.price_cents === 0}
                className={`btn mt-5 w-full ${current ? "btn-secondary" : "btn-primary"}`}
              >
                {current ? "Current plan" : busyPlan === plan.id ? "Redirecting…" : plan.price_cents === 0 ? "Included" : "Upgrade"}
              </button>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
