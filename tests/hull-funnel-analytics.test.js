/**
 * Hull-cleaning funnel events: when calculator_started / calculator_completed /
 * order_started / order_submitted / order_failed fire and with which props.
 *
 * The trackers are plain JS and are driven directly. posthog-js is mocked so
 * the services singleton (src/services/lib/analytics.js) can be exercised end
 * to end without a network. The React wiring in Diving.jsx / DivingOrder.jsx is
 * pinned with source-text assertions, the same convention the other order-page
 * tests use (the page needs Stripe Elements and a router to render).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const posthog = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock('posthog-js/dist/module.slim', () => ({ default: posthog }));

const { useEffect, useLocation, useRef } = vi.hoisted(() => ({
  useEffect: vi.fn((effect) => effect()),
  useLocation: vi.fn(),
  useRef: vi.fn((initial) => ({ current: initial })),
}));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal()), useEffect, useRef }));
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useLocation }));

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const CLEANING_VIS = { boatLength: true, boatType: true, frequency: true, propellers: true, paintAge: true, lastCleaned: true, anodes: true };
const INSPECTION_VIS = { boatLength: true, boatType: true, frequency: false, propellers: false, paintAge: false, lastCleaned: false, anodes: false };
const RECOVERY_VIS = { boatLength: false, boatType: false, frequency: false, propellers: false, paintAge: false, lastCleaned: false, anodes: false };

const DEFAULT_INPUTS = {
  serviceKey: 'cleaning', boatLength: 35, boatType: 'sailboat', hullType: 'monohull', frequency: 'monthly',
  propellerCount: 1, paintAge: '<6mo', lastCleaned: '<2', anodeCount: 0,
};

function calculatorHarness(lib, visibility = CLEANING_VIS, estimateTotal = 157.5) {
  const send = vi.fn();
  let state = { ...DEFAULT_INPUTS };
  const tracker = lib.createCalculatorTracker({
    track: send,
    getSnapshot: () => ({ ...state, estimateTotal, visibility }),
  });
  tracker.observe(state); // mount baseline
  const change = (patch) => {
    state = { ...state, ...patch };
    tracker.observe(state);
  };
  return { send, tracker, change };
}

let lib;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.unstubAllEnvs();
  vi.resetModules();
  posthog.init.mockReset();
  posthog.capture.mockReset();
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
  lib = await import('../src/services/lib/analytics.js');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('calculator_started', () => {
  it('does not fire on mount, fires on the first input change, and only once', () => {
    const { send, change } = calculatorHarness(lib);
    expect(send).not.toHaveBeenCalled();

    change({ frequency: 'quarterly' });
    change({ hullType: 'catamaran' });

    expect(send.mock.calls.filter(([event]) => event === 'calculator_started'))
      .toStrictEqual([['calculator_started', { service: 'cleaning' }]]);
  });

  it('reports the service chosen by that first interaction', () => {
    const { send, change } = calculatorHarness(lib, INSPECTION_VIS);
    change({ serviceKey: 'underwater_inspection' });
    expect(send).toHaveBeenCalledWith('calculator_started', { service: 'underwater_inspection' });
  });
});

describe('calculator_completed', () => {
  it('fires after length AND a hull condition are set and the visitor pauses, with bucketed props', () => {
    const { send, change } = calculatorHarness(lib, CLEANING_VIS, 182);
    change({ boatLength: 4 });
    change({ boatLength: 42 });
    vi.advanceTimersByTime(5000);
    expect(send.mock.calls.map(([event]) => event)).toStrictEqual(['calculator_started']);

    change({ paintAge: '1-1.5yr' });
    vi.advanceTimersByTime(lib.CALCULATOR_COMPLETE_DELAY_MS - 1);
    expect(send).toHaveBeenCalledTimes(1);
    change({ lastCleaned: '5-6' }); // resets the quiet period
    vi.advanceTimersByTime(lib.CALCULATOR_COMPLETE_DELAY_MS - 1);
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);

    expect(send.mock.calls[1]).toStrictEqual(['calculator_completed', {
      service: 'cleaning',
      frequency: 'monthly',
      trigger: 'estimate',
      boat_type: 'sailboat',
      hull: 'monohull',
      length_bucket: '40-49',
      estimate_bucket: '150-199',
    }]);

    change({ boatLength: 50 });
    vi.advanceTimersByTime(10_000);
    expect(send.mock.calls.filter(([event]) => event === 'calculator_completed')).toHaveLength(1);
  });

  it('needs a valid length: a cleared length field does not complete', () => {
    const { send, change } = calculatorHarness(lib);
    change({ paintAge: '6-12mo' });
    change({ boatLength: '' });
    vi.advanceTimersByTime(10_000);
    expect(send.mock.calls.map(([event]) => event)).toStrictEqual(['calculator_started']);
  });

  it('fires immediately on Get Started, starting first if needed, and never twice', () => {
    const { send, tracker } = calculatorHarness(lib);
    tracker.getStarted();
    tracker.getStarted();
    expect(send.mock.calls).toStrictEqual([
      ['calculator_started', { service: 'cleaning' }],
      ['calculator_completed', {
        service: 'cleaning', frequency: 'monthly', trigger: 'get_started',
        boat_type: 'sailboat', hull: 'monohull', length_bucket: '30-39', estimate_bucket: '150-199',
      }],
    ]);
  });

  it('Get Started cancels a pending completion so it is reported once, as get_started', () => {
    const { send, change, tracker } = calculatorHarness(lib);
    change({ boatLength: 36 });
    change({ lastCleaned: '2-4' });
    tracker.getStarted();
    vi.advanceTimersByTime(10_000);
    const completed = send.mock.calls.filter(([event]) => event === 'calculator_completed');
    expect(completed).toHaveLength(1);
    expect(completed[0][1].trigger).toBe('get_started');
  });

  it('reports only the fields the service shows: an inspection completes on length alone, as one-time', () => {
    const { send, change } = calculatorHarness(lib, INSPECTION_VIS, 139.65);
    change({ serviceKey: 'underwater_inspection' });
    change({ boatLength: 31 });
    vi.advanceTimersByTime(lib.CALCULATOR_COMPLETE_DELAY_MS);
    expect(send.mock.calls[1]).toStrictEqual(['calculator_completed', {
      service: 'underwater_inspection', frequency: 'one_time', trigger: 'estimate',
      boat_type: 'sailboat', hull: 'monohull', length_bucket: '30-39', estimate_bucket: '<150',
    }]);
  });

  it('services with no length or conditions (item recovery) complete only on Get Started', () => {
    const { send, change, tracker } = calculatorHarness(lib, RECOVERY_VIS, 149);
    change({ serviceKey: 'item_recovery' });
    vi.advanceTimersByTime(10_000);
    expect(send.mock.calls.map(([event]) => event)).toStrictEqual(['calculator_started']);
    tracker.getStarted();
    expect(send.mock.calls[1]).toStrictEqual(['calculator_completed', {
      service: 'item_recovery', frequency: 'one_time', trigger: 'get_started', estimate_bucket: '<150',
    }]);
  });

  it('dispose cancels a pending completion (page left before the pause ended)', () => {
    const { send, change, tracker } = calculatorHarness(lib);
    change({ boatLength: 36 });
    change({ paintAge: '2+yr' });
    tracker.dispose();
    vi.advanceTimersByTime(10_000);
    expect(send.mock.calls.map(([event]) => event)).toStrictEqual(['calculator_started']);
  });
});

describe('order_started source', () => {
  const params = (values = {}) => new URLSearchParams(values);

  it('classifies estimator, prefill and direct visits', () => {
    const estimatorParams = params({ service: 'cleaning', length: '35', estimate: '158' });
    expect(lib.orderStartSource({ state: lib.ESTIMATOR_NAV_STATE, searchParams: estimatorParams })).toBe('estimator');
    expect(lib.orderStartSource({ state: null, searchParams: estimatorParams })).toBe('prefill');
    expect(lib.orderStartSource({ searchParams: params({ leadBoatId: 'abc', boatName: 'x' }) })).toBe('prefill');
    expect(lib.orderStartSource({ searchParams: params({ customerEmail: 'ada@example.com' }) })).toBe('prefill');
    expect(lib.orderStartSource({ searchParams: params() })).toBe('direct');
    expect(lib.orderStartSource({ searchParams: params({ service: 'item_recovery', promo: 'WELCOME26' }) })).toBe('direct');
    expect(lib.orderStartSource({ state: { analyticsSource: 'elsewhere' }, searchParams: params() })).toBe('direct');
  });
});

describe('order tracker', () => {
  function orderHarness(source, context = { service: 'cleaning', frequency: 'bimonthly' }) {
    const send = vi.fn();
    const ctx = { ...context };
    const tracker = lib.createOrderTracker({ track: send, source, getContext: () => ctx });
    return { send, tracker, ctx };
  }

  it.each(['estimator', 'prefill'])('fires order_started on mount for a %s visit', (source) => {
    const { send, tracker } = orderHarness(source);
    tracker.mounted();
    tracker.interacted();
    expect(send.mock.calls).toStrictEqual([
      ['order_started', { service: 'cleaning', frequency: 'bimonthly', source }],
    ]);
  });

  it('waits for the first interaction on a direct visit', () => {
    const { send, tracker } = orderHarness('direct', { service: 'item_recovery', frequency: 'one_time' });
    tracker.mounted();
    expect(send).not.toHaveBeenCalled();
    tracker.interacted();
    tracker.interacted();
    expect(send.mock.calls).toStrictEqual([
      ['order_started', { service: 'item_recovery', frequency: 'one_time', source: 'direct' }],
    ]);
  });

  it('reports an unchosen frequency as unset and a legacy service key as cleaning', () => {
    const { send, tracker } = orderHarness('direct', { service: 'recurring_cleaning', frequency: '' });
    tracker.interacted();
    expect(send).toHaveBeenCalledWith('order_started', { service: 'cleaning', frequency: 'unset', source: 'direct' });
  });

  it('order_submitted carries the live frequency and payment method, once', () => {
    const { send, tracker, ctx } = orderHarness('prefill', { service: 'cleaning', frequency: '' });
    tracker.mounted();
    ctx.frequency = 'monthly';
    tracker.submitted('card');
    tracker.submitted('card');
    expect(send.mock.calls).toStrictEqual([
      ['order_started', { service: 'cleaning', frequency: 'unset', source: 'prefill' }],
      ['order_submitted', { service: 'cleaning', frequency: 'monthly', payment: 'card', result: 'success' }],
    ]);
  });

  it('order_failed carries the failing step', () => {
    const { send, tracker } = orderHarness('direct');
    tracker.interacted();
    tracker.failed('payment-intent');
    tracker.failed('stripe-confirmation');
    expect(send.mock.calls.slice(1)).toStrictEqual([
      ['order_failed', { service: 'cleaning', frequency: 'bimonthly', step: 'payment-intent', result: 'failed' }],
      ['order_failed', { service: 'cleaning', frequency: 'bimonthly', step: 'stripe-confirmation', result: 'failed' }],
    ]);
  });
});

describe('services singleton with posthog-js mocked', () => {
  it('sends the funnel through posthog-js with only allowlisted props', async () => {
    lib.analytics.initialize();
    expect(await lib.analytics.whenReady()).toBe(true);
    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init.mock.calls[0][0]).toBe('phc_test');
    expect(posthog.init.mock.calls[0][1]).toMatchObject({ autocapture: false, disable_session_recording: true, person_profiles: 'never' });

    const order = lib.createOrderTracker({
      source: 'estimator',
      getContext: () => ({ service: 'cleaning', frequency: 'monthly', customerEmail: 'ada@example.com' }),
    });
    order.mounted();
    order.submitted('invoice');

    expect(posthog.capture.mock.calls.map(([event, props]) => [event, props])).toStrictEqual([
      ['order_started', { service: 'cleaning', frequency: 'monthly', source: 'estimator' }],
      ['order_submitted', { service: 'cleaning', frequency: 'monthly', payment: 'invoice', result: 'success' }],
    ]);
  });

  it('never loads or calls posthog-js without VITE_POSTHOG_KEY', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const noKey = await import('../src/services/lib/analytics.js');
    expect(noKey.analytics.initialize()).toBe(false);
    expect(noKey.track('order_started', { service: 'cleaning' })).toBe(false);
    noKey.createCalculatorTracker({ getSnapshot: () => ({}) }).getStarted();
    expect(await noKey.analytics.whenReady()).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });
});

describe('SPA pageviews', () => {
  it('captures $pageview per route change with UTM params, and the referrer host on the first one only', async () => {
    const { ServicesAnalyticsTracker } = await import('../src/services/App.jsx');
    const capture = vi.fn();
    const firstRef = { current: true };
    useRef.mockReturnValue(firstRef);
    globalThis.document = { referrer: 'https://www.google.com/search?q=ada@example.com' };
    try {
      useLocation.mockReturnValueOnce({ pathname: '/hull-cleaning', search: '?utm_source=newsletter&customerEmail=ada@example.com' });
      ServicesAnalyticsTracker({ capture });
      useLocation.mockReturnValueOnce({ pathname: '/hull-cleaning/order', search: '?customerName=Ada&estimate=158' });
      ServicesAnalyticsTracker({ capture });
    } finally {
      delete globalThis.document;
      useRef.mockImplementation((initial) => ({ current: initial }));
    }
    expect(capture.mock.calls).toStrictEqual([
      ['$pageview', { surface: 'services', utm_source: 'newsletter', referrer: 'www.google.com' }],
      ['$pageview', { surface: 'services' }],
    ]);
  });
});

describe('page wiring', () => {
  const diving = read('../src/services/pages/Diving.jsx');
  const order = read('../src/services/pages/DivingOrder.jsx');
  const app = read('../src/services/App.jsx');
  const main = read('../src/services/main.jsx');
  const prerender = read('../scripts/prerender.mjs');

  it('estimator: observes every input in an effect and reports Get Started before navigating', () => {
    expect(diving).toContain('calculatorTrackerRef.current.observe({');
    expect(diving).toContain('onGetStarted={() => calculatorTrackerRef.current.getStarted()}');
    const getStarted = diving.slice(diving.indexOf('const handleGetStarted'), diving.indexOf('return (', diving.indexOf('const handleGetStarted')));
    expect(getStarted.indexOf('onGetStarted?.()')).toBeGreaterThan(-1);
    expect(getStarted.indexOf('onGetStarted?.()')).toBeLessThan(getStarted.indexOf('navigate('));
    expect(getStarted).toContain('{ state: ESTIMATOR_NAV_STATE }');
  });

  it('order form: order_submitted fires only right after a success state is set', () => {
    const submittedCalls = [...order.matchAll(/orderTrackerRef\.current\.submitted\("(\w+)"\)/g)].map((m) => m[1]);
    expect(submittedCalls).toStrictEqual(['invoice', 'card']);
    expect(order).toMatch(/setSuccess\(\{ orderNumber, promoApplied, paymentPreference: PAYMENT_PREFERENCE_INVOICE \}\);\n\s+orderTrackerRef\.current\.submitted\("invoice"\);/);
    expect(order).toMatch(/if \(result\.error\) throw result\.error;\n\n\s+setSuccess\(\{ orderNumber, promoApplied \}\);\n\s+orderTrackerRef\.current\.submitted\("card"\);/);
    const catchBlock = order.slice(order.indexOf('} catch (err) {\n      console.error("Order submission error:"'));
    expect(catchBlock.slice(0, 300)).toContain('orderTrackerRef.current.failed(analyticsStep);');
  });

  it('order form: started on mount (prefilled) or on first focus/click/field change', () => {
    expect(order).toContain('orderTrackerRef.current.mounted();');
    expect(order).toContain('<form onSubmit={handleSubmit} onFocus={markOrderInteraction} onClick={handleFormClick}');
    const updateFieldStart = order.indexOf('const updateField = useCallback');
    const updateField = order.slice(updateFieldStart, order.indexOf('}, [markOrderInteraction]);', updateFieldStart));
    expect(updateField).toContain('markOrderInteraction();');
  });

  it('pageviews are tracked app-wide and analytics is initialized at the services entry', () => {
    expect(app).toContain('<ServicesAnalyticsTracker />');
    expect(main).toContain('analytics.initialize();');
  });

  it('prerender flags the page so analytics never initializes, and fails the build if it did', () => {
    expect(prerender).toContain('window.__BC_PRERENDER__ = true');
    expect(prerender).toContain('prerendered HTML references PostHog');
    expect(prerender).toContain('analytics requests during prerender');
  });
});
