/**
 * Services SPA analytics singleton plus the hull-cleaning funnel trackers.
 *
 * `track` is a no-op unless VITE_POSTHOG_KEY is set at build time, and it is
 * skipped under prerender and for Do Not Track visitors (see src/analytics.js).
 * posthog-js is loaded with a dynamic import, so it never lands in the initial
 * bundle or the prerendered HTML.
 *
 * The trackers below are plain JS (no React) so the "fire once, at the right
 * moment, with these props" rules are unit tested without a DOM.
 */
import {
  createAnalytics,
  estimateBucket,
  lengthBucket,
  normalizeFrequency,
  normalizeServiceKey,
} from "../../analytics.js";

export const analytics = createAnalytics({
  loadSdk: () => import("posthog-js/dist/module.slim"),
  env: import.meta.env,
});

export function track(event, properties) {
  return analytics.capture(event, properties);
}

// ── /hull-cleaning estimator ──

/** Quiet period after the last input change before an estimate counts as "completed". */
export const CALCULATOR_COMPLETE_DELAY_MS = 1500;

const CONDITION_FIELDS = ["paintAge", "lastCleaned"];

/**
 * Props for calculator_completed, from the estimator's current state. Only the
 * fields the selected service actually shows are reported, and length and
 * price only as coarse buckets.
 */
export function calculatorCompletedProps(snapshot, trigger) {
  const vis = snapshot?.visibility || {};
  const props = {
    service: normalizeServiceKey(snapshot?.serviceKey),
    frequency: vis.frequency ? normalizeFrequency(snapshot?.frequency) : "one_time",
    trigger,
  };
  if (vis.boatType) {
    props.boat_type = snapshot?.boatType;
    props.hull = snapshot?.hullType;
  }
  if (vis.boatLength) {
    const bucket = lengthBucket(snapshot?.boatLength);
    if (bucket) props.length_bucket = bucket;
  }
  const estimate = estimateBucket(snapshot?.estimateTotal);
  if (estimate) props.estimate_bucket = estimate;
  return props;
}

/**
 * One tracker per estimator page view (component mount).
 *  - calculator_started: the first change to any estimator input.
 *  - calculator_completed: once the visitor has set a length AND a hull
 *    condition (for services that show them) and then paused for
 *    CALCULATOR_COMPLETE_DELAY_MS, or immediately on "Get Started".
 * Each fires at most once per tracker.
 */
export function createCalculatorTracker({
  track: send = track,
  getSnapshot,
  delayMs = CALCULATOR_COMPLETE_DELAY_MS,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  let baseline = null;
  let started = false;
  let completed = false;
  let timer = null;
  const touched = new Set();

  function snapshot() {
    try {
      return getSnapshot() || {};
    } catch {
      return {};
    }
  }

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function requirementsMet(current) {
    const vis = current.visibility || {};
    const needsLength = !!vis.boatLength;
    const needsConditions = !!(vis.paintAge || vis.lastCleaned);
    // Services with neither (item recovery, propeller, anodes) only complete
    // on "Get Started".
    if (!needsLength && !needsConditions) return false;
    if (needsLength && (!touched.has("boatLength") || !lengthBucket(current.boatLength))) return false;
    if (needsConditions && !CONDITION_FIELDS.some((field) => touched.has(field))) return false;
    return true;
  }

  function start() {
    if (started) return;
    started = true;
    send("calculator_started", { service: normalizeServiceKey(snapshot().serviceKey) });
  }

  function complete(trigger) {
    if (completed) return;
    completed = true;
    cancelTimer();
    send("calculator_completed", calculatorCompletedProps(snapshot(), trigger));
  }

  return {
    /** Call with the estimator inputs on every render; the first call is the baseline. */
    observe(inputs) {
      const previous = baseline;
      baseline = { ...inputs };
      if (!previous) return;
      const changed = Object.keys(inputs).filter((field) => previous[field] !== inputs[field]);
      if (!changed.length) return;

      start();
      for (const field of changed) touched.add(field);
      if (completed) return;

      cancelTimer();
      if (requirementsMet(snapshot())) {
        timer = setTimer(() => {
          timer = null;
          if (requirementsMet(snapshot())) complete("estimate");
        }, delayMs);
      }
    },
    getStarted() {
      start();
      complete("get_started");
    },
    dispose: cancelTimer,
  };
}

// ── /hull-cleaning/order form ──

/** Query params that mean the order form opened with a quote or customer details filled in. */
const PREFILL_PARAMS = [
  "estimate", "length", "leadBoatId", "boatName", "boatMake", "boatModel",
  "marina", "customerName", "customerEmail", "customerPhone", "paintAge", "lastCleaned",
];

/** Navigation state the estimator's "Get Started" button attaches. */
export const ESTIMATOR_NAV_STATE = Object.freeze({ analyticsSource: "estimator" });

export function orderStartSource({ state, searchParams } = {}) {
  if (state?.analyticsSource === "estimator") return "estimator";
  try {
    if (PREFILL_PARAMS.some((name) => searchParams?.get(name))) return "prefill";
  } catch {
    // Unreadable params are treated as a direct visit.
  }
  return "direct";
}

/**
 * One tracker per order form mount.
 *  - order_started: on mount when the form opened prefilled (estimator or a
 *    quote/prefill link), otherwise on the first interaction with the form.
 *  - order_submitted: only after the order succeeded (card confirmed, or the
 *    pay-by-invoice request recorded).
 *  - order_failed: when a submit attempt fails, with the step it failed at.
 */
export function createOrderTracker({ track: send = track, source, getContext }) {
  let started = false;
  let submitted = false;

  function base() {
    let context = {};
    try {
      context = getContext() || {};
    } catch {
      context = {};
    }
    return {
      service: normalizeServiceKey(context.service),
      frequency: normalizeFrequency(context.frequency),
    };
  }

  function start() {
    if (started) return;
    started = true;
    send("order_started", { ...base(), source });
  }

  return {
    source,
    mounted() {
      if (source !== "direct") start();
    },
    interacted: start,
    submitted(payment) {
      if (submitted) return;
      submitted = true;
      start();
      send("order_submitted", { ...base(), payment, result: "success" });
    },
    failed(step) {
      send("order_failed", { ...base(), step, result: "failed" });
    },
  };
}
