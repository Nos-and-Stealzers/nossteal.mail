"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api, type SubscriptionPlan, type Subscription } from "@/lib/api";

export default function BillingPage() {
  const { loading } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    Promise.all([api.listPlans(), api.getSubscription()]).then(([p, s]) => {
      setPlans(p.plans);
      setSubscription(s.subscription);
    });
  }, [loading]);

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

  if (loading) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <Link href="/inbox" className="text-sm text-indigo-400 hover:underline">
          ← Back to inbox
        </Link>
      </header>
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-6">
        <section>
          <h1 className="mb-3 text-xl font-semibold">Billing</h1>
          {subscription && (
            <div className="mb-4 flex items-center justify-between rounded border border-neutral-800 p-4 text-sm">
              <div>
                <p className="font-medium">
                  Current plan: {subscription.plan_name} ({subscription.subscription_status})
                </p>
                {subscription.subscription_expires_at && (
                  <p className="text-neutral-500">
                    Renews/expires {new Date(subscription.subscription_expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              {subscription.stripe_customer_id && (
                <button
                  onClick={handleManageBilling}
                  disabled={portalBusy}
                  className="rounded border border-neutral-700 px-3 py-1.5 hover:bg-neutral-900 disabled:opacity-50"
                >
                  {portalBusy ? "Opening..." : "Manage billing"}
                </button>
              )}
            </div>
          )}
          {error && <p className="mb-4 rounded bg-red-950 p-2 text-sm text-red-300">{error}</p>}
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <div key={plan.id} className="flex flex-col rounded border border-neutral-800 p-4">
              <p className="text-lg font-semibold">{plan.name}</p>
              <p className="mt-1 text-2xl font-bold">
                ${(plan.price_cents / 100).toFixed(2)}
                <span className="text-sm font-normal text-neutral-500">/mo</span>
              </p>
              <ul className="mt-3 flex-1 space-y-1 text-sm text-neutral-400">
                {plan.features.map((f, i) => (
                  <li key={i}>· {f}</li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={busyPlan === plan.id || subscription?.account_type === plan.id || plan.price_cents === 0}
                className="mt-4 rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                {subscription?.account_type === plan.id
                  ? "Current plan"
                  : busyPlan === plan.id
                    ? "Redirecting..."
                    : plan.price_cents === 0
                      ? "Included"
                      : "Upgrade"}
              </button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
