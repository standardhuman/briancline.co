// Loads Stripe for the order page. The publishable key comes from the
// get-stripe-config edge function so the page stays in sync with the backend's
// test/live mode.
//
// Every failure rejects, and the whole load is capped by a timeout. The page
// must never wait forever: a retired Supabase key (Oct 2026) made this call
// fail and the order form spun with no message for weeks.

export const STRIPE_CONFIG_TIMEOUT_MS = 12000;

export async function loadStripeConfig({
  supabaseUrl,
  headers,
  loadStripe,
  fetchImpl = fetch,
  timeoutMs = STRIPE_CONFIG_TIMEOUT_MS,
}) {
  if (!supabaseUrl) throw new Error("Order form is missing its Supabase URL");

  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Stripe config timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  const load = (async () => {
    const res = await fetchImpl(`${supabaseUrl}/functions/v1/get-stripe-config`, {
      headers,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Stripe config request failed: HTTP ${res.status}`);
    const { publishableKey } = await res.json();
    if (typeof publishableKey !== "string" || !publishableKey.startsWith("pk_")) {
      throw new Error("Stripe config response has no publishable key");
    }
    const stripe = await loadStripe(publishableKey);
    if (!stripe) throw new Error("Stripe.js did not load");
    return stripe;
  })();

  try {
    return await Promise.race([load, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
