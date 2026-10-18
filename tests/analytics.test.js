/**
 * Privacy contract for src/analytics.js (the PostHog wrapper). posthog-js is
 * replaced by a recording double injected through `loadSdk`; one test drives
 * the real installed slim SDK to pin before_send compatibility.
 */
import { describe, expect, it, vi } from 'vitest';
import { PostHog } from 'posthog-js/dist/module.slim';
import {
  ANALYTICS_EVENTS,
  analyticsBlockedReason,
  buildPosthogConfig,
  createAnalytics,
  estimateBucket,
  internalTrafficFlag,
  lengthBucket,
  normalizeFrequency,
  normalizeServiceKey,
  safeCurrentUrl,
  sanitizeAttribution,
  sanitizeProperties,
} from '../src/analytics.js';

const captureUuid = '019fdace-7e94-7e7e-a9df-703d923b321a';
const captureTimestamp = new Date('2026-10-18T12:00:00.000Z');
const orderLocation = {
  origin: 'https://briancline.co',
  pathname: '/hull-cleaning/order',
  search: '?customerEmail=ada@example.com&customerPhone=4155550123',
  hash: '#payment',
};

function createSdk() {
  const calls = { inits: [], captures: [] };
  return {
    calls,
    register(props) {
      calls.registers = [...(calls.registers || []), props];
    },
    unregister(name) {
      calls.unregisters = [...(calls.unregisters || []), name];
    },
    init(key, options) {
      calls.inits.push({ key, options });
    },
    capture(event, properties, options) {
      calls.captures.push({ event, properties, options });
    },
  };
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

function setup({ env = { VITE_POSTHOG_KEY: 'phc_test' }, nav = {}, win = {}, location = orderLocation, sdk = createSdk(), storage = memoryStorage() } = {}) {
  const loadSdk = vi.fn(async () => ({ default: sdk }));
  const analytics = createAnalytics({
    loadSdk,
    env,
    getLocation: () => location,
    getNavigator: () => nav,
    getWindow: () => win,
    getStorage: () => storage,
  });
  return { analytics, loadSdk, sdk };
}

describe('initialization gates', () => {
  it('is a no-op without a nonblank key: posthog-js is never loaded', async () => {
    for (const env of [{}, { VITE_POSTHOG_KEY: '' }, { VITE_POSTHOG_KEY: '   ' }, null]) {
      const { analytics, loadSdk, sdk } = setup({ env });
      expect(analytics.initialize()).toBe(false);
      expect(analytics.capture('calculator_started', { service: 'cleaning' })).toBe(false);
      expect(await analytics.whenReady()).toBe(false);
      expect(analytics.isEnabled()).toBe(false);
      expect(loadSdk).not.toHaveBeenCalled();
      expect(sdk.calls).toStrictEqual({ inits: [], captures: [] });
    }
  });

  it.each([
    ['the prerender flag', {}, { __BC_PRERENDER__: true }, 'prerender'],
    ['an automated browser (navigator.webdriver)', { webdriver: true }, {}, 'automation'],
    ['Do Not Track', { doNotTrack: '1' }, {}, 'do-not-track'],
    ['legacy window.doNotTrack', {}, { doNotTrack: '1' }, 'do-not-track'],
    ['Global Privacy Control', { globalPrivacyControl: true }, {}, 'do-not-track'],
  ])('never loads posthog-js under %s', async (_label, nav, win, reason) => {
    expect(analyticsBlockedReason({ navigator: nav, window: win })).toBe(reason);
    const { analytics, loadSdk } = setup({ nav, win });
    expect(analytics.initialize()).toBe(false);
    expect(analytics.capture('$pageview', { surface: 'services' })).toBe(false);
    expect(loadSdk).not.toHaveBeenCalled();
  });

  it('runs for an ordinary browser', () => {
    expect(analyticsBlockedReason({ navigator: { webdriver: false, doNotTrack: '0' }, window: {} })).toBe('');
  });

  it('initializes once with the trimmed key and the pinned privacy config', async () => {
    const { analytics, loadSdk, sdk } = setup({ env: { VITE_POSTHOG_KEY: ' phc_test ' } });
    expect(analytics.initialize()).toBe(true);
    expect(analytics.initialize()).toBe(true);
    expect(await analytics.whenReady()).toBe(true);
    expect(loadSdk).toHaveBeenCalledTimes(1);
    expect(sdk.calls.inits).toHaveLength(1);
    const { key, options } = sdk.calls.inits[0];
    expect(key).toBe('phc_test');
    expect(options).toStrictEqual({
      api_host: 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      enable_heatmaps: false,
      rageclick: false,
      capture_performance: false,
      capture_exceptions: false,
      disable_session_recording: true,
      session_recording: { maskAllInputs: true },
      person_profiles: 'never',
      advanced_disable_flags: true,
      disable_surveys: true,
      disable_product_tours: true,
      disable_conversations: true,
      disable_web_experiments: true,
      disable_external_dependency_loading: true,
      save_campaign_params: false,
      save_referrer: false,
      respect_dnt: true,
      disable_capture_url_hashes: true,
      mask_personal_data_properties: true,
      get_current_url: expect.any(Function),
      before_send: expect.any(Function),
    });
    expect(options.get_current_url('https://briancline.co/hull-cleaning/order?customerEmail=ada@example.com#x'))
      .toBe('https://briancline.co/hull-cleaning/order');
  });

  it('uses VITE_POSTHOG_HOST when set', async () => {
    const { analytics, sdk } = setup({ env: { VITE_POSTHOG_KEY: 'k', VITE_POSTHOG_HOST: ' https://eu.i.posthog.com ' } });
    analytics.initialize();
    await analytics.whenReady();
    expect(sdk.calls.inits[0].options.api_host).toBe('https://eu.i.posthog.com');
  });

  it('pins recording off and input masking on in the pure config builder', () => {
    const config = buildPosthogConfig({ apiHost: 'h', getCurrentUrl: () => '', beforeSend: () => null });
    expect(config.disable_session_recording).toBe(true);
    expect(config.session_recording.maskAllInputs).toBe(true);
    expect(config.autocapture).toBe(false);
  });

  it('fails closed when posthog-js cannot load', async () => {
    const analytics = createAnalytics({
      loadSdk: () => Promise.reject(new Error('offline')),
      env: { VITE_POSTHOG_KEY: 'k' },
      getNavigator: () => ({}),
      getWindow: () => ({}),
    });
    expect(analytics.capture('calculator_started', { service: 'cleaning' })).toBe(true);
    expect(await analytics.whenReady()).toBe(false);
    expect(analytics.capture('calculator_started', { service: 'cleaning' })).toBe(false);
  });

  it('contains a throwing SDK capture', async () => {
    const sdk = createSdk();
    sdk.capture = () => { throw new Error('boom'); };
    const { analytics } = setup({ sdk });
    analytics.initialize();
    await analytics.whenReady();
    expect(analytics.capture('calculator_started', { service: 'cleaning' })).toBe(false);
  });
});

describe('capture', () => {
  it('queues events captured before posthog-js loads and flushes them in order with their timestamps', async () => {
    const { analytics, sdk } = setup();
    expect(analytics.capture('calculator_started', { service: 'cleaning' })).toBe(true);
    expect(analytics.capture('calculator_completed', { service: 'cleaning', frequency: 'monthly' })).toBe(true);
    expect(sdk.calls.captures).toHaveLength(0);

    await analytics.whenReady();

    expect(sdk.calls.captures.map(({ event, properties }) => ({ event, properties }))).toStrictEqual([
      { event: 'calculator_started', properties: { service: 'cleaning', $current_url: 'https://briancline.co/hull-cleaning/order' } },
      {
        event: 'calculator_completed',
        properties: { service: 'cleaning', frequency: 'monthly', $current_url: 'https://briancline.co/hull-cleaning/order' },
      },
    ]);
    for (const { options } of sdk.calls.captures) expect(options.timestamp).toBeInstanceOf(Date);

    analytics.capture('order_started', { service: 'cleaning', frequency: 'monthly', source: 'direct' });
    expect(sdk.calls.captures[2]).toStrictEqual({
      event: 'order_started',
      properties: { service: 'cleaning', frequency: 'monthly', source: 'direct', $current_url: 'https://briancline.co/hull-cleaning/order' },
      options: undefined,
    });
  });

  it('accepts every funnel event and rejects any other name', async () => {
    const { analytics, sdk } = setup();
    analytics.initialize();
    await analytics.whenReady();
    for (const event of ANALYTICS_EVENTS) expect(analytics.capture(event, {})).toBe(true);
    for (const event of ['$autocapture', '$identify', '$set', 'service_viewed', 'Order Submitted', '']) {
      expect(analytics.capture(event, {})).toBe(false);
    }
    expect(sdk.calls.captures.map((c) => c.event)).toStrictEqual([...ANALYTICS_EVENTS]);
  });
});

describe('property allowlist', () => {
  it('drops PII keys and free text, keeping only allowlisted keys with allowlisted values', () => {
    expect(sanitizeProperties({
      service: 'cleaning',
      frequency: 'bimonthly',
      boat_type: 'sailboat',
      hull: 'catamaran',
      length_bucket: '30-39',
      estimate_bucket: '150-199',
      trigger: 'estimate',
      source: 'prefill',
      payment: 'invoice',
      step: 'stripe-confirmation',
      result: 'failed',
      surface: 'services',
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.com',
      customerPhone: '415-555-0123',
      boatName: 'Private Boat',
      marina: 'Berkeley Marina',
      billingAddress: '1 Main St',
      notes: 'gate code 1234',
      email: 'ada@example.com',
      boatLength: '35',
      estimate: '158',
    })).toStrictEqual({
      service: 'cleaning',
      frequency: 'bimonthly',
      boat_type: 'sailboat',
      hull: 'catamaran',
      length_bucket: '30-39',
      estimate_bucket: '150-199',
      trigger: 'estimate',
      source: 'prefill',
      payment: 'invoice',
      step: 'stripe-confirmation',
      result: 'failed',
      surface: 'services',
    });
  });

  it('drops values outside each enum and every non-string value instead of coercing', () => {
    expect(sanitizeProperties({
      service: 'Ada Lovelace',
      frequency: 'weekly',
      boat_type: 'yacht',
      hull: 'ada@example.com',
      length_bucket: '35',
      estimate_bucket: 158,
      source: { nested: 'estimator' },
      result: ['success'],
      step: null,
      payment: true,
    })).toStrictEqual({});
    expect(sanitizeProperties(null)).toStrictEqual({});
    expect(sanitizeProperties(['service'])).toStrictEqual({});
  });

  it('keeps safe UTM labels and only a referrer hostname', () => {
    expect(sanitizeAttribution({
      search: '?utm_source=Newsletter&utm_medium=email&utm_campaign=spring-2026-10-01&utm_content=ada@example.com&utm_term=415_555_0123&customerEmail=ada@example.com',
      referrer: 'https://www.google.com/search?q=ada@example.com',
    })).toStrictEqual({
      utm_source: 'Newsletter',
      utm_medium: 'email',
      utm_campaign: 'spring-2026-10-01',
      referrer: 'www.google.com',
    });
    expect(sanitizeAttribution({ search: '?utm_source=sk_live_51N6wF6ABCDEF123456', referrer: 'javascript:alert(1)' }))
      .toStrictEqual({});
  });

  it('reduces URLs to origin and pathname', () => {
    expect(safeCurrentUrl(orderLocation)).toBe('https://briancline.co/hull-cleaning/order');
    expect(safeCurrentUrl({ origin: 'javascript:', pathname: '/x' })).toBe('');
    expect(safeCurrentUrl({ origin: 'https://briancline.co', pathname: '//evil.example/x' })).toBe('');
  });
});

describe('before_send', () => {
  async function beforeSend() {
    const { analytics, sdk } = setup({ env: { VITE_POSTHOG_KEY: 'phc_test' } });
    analytics.initialize();
    await analytics.whenReady();
    return sdk.calls.inits[0].options.before_send;
  }

  it('rebuilds SDK-enriched events from validated fields, stripping URL queries and fingerprint data', async () => {
    const scrub = await beforeSend();
    const enriched = {
      uuid: captureUuid,
      event: 'order_started',
      timestamp: captureTimestamp,
      properties: {
        service: 'cleaning',
        frequency: 'monthly',
        source: 'prefill',
        customerEmail: 'ada@example.com',
        $current_url: 'https://briancline.co/hull-cleaning/order?customerEmail=ada@example.com&boatName=Secret#payment',
        $referrer: 'https://search.example/private?q=ada@example.com',
        $initial_current_url: 'https://briancline.co/hull-cleaning/order?customerPhone=4155550123',
        $session_entry_url: 'https://briancline.co/hull-cleaning/order?customerName=Ada',
        $session_entry_utm_source: 'private',
        gclid: 'private-google-click-id',
        token: 'phc_test',
        distinct_id: '019fdace-7e93-7182-bd9a-e046aa0958a3',
        $device_id: '019fdace-7e93-7182-bd9a-e046aa0958a3',
        $session_id: '019fdace-7ea1-7585-af86-620e0304007e',
        $window_id: '019fdace-7ea1-7585-af86-620f559a00ac',
        $lib: 'web',
        $lib_version: '1.438.12',
        $insert_id: 'abcdefghijklmnop',
        $time: 1786027200.5,
        $process_person_profile: false,
        $raw_user_agent: 'Mozilla/5.0 fingerprint',
        $screen_width: 1440,
        $timezone: 'America/Los_Angeles',
        $browser: 'Mobile Safari',
        $browser_version: 18,
        $os: 'iOS',
        $os_version: '18.1',
        $device_type: 'Mobile',
        $host: 'briancline.co',
        $pathname: '/hull-cleaning/order',
        $set: { email: 'ada@example.com' },
        $future_sdk_fingerprint: 'must fail closed',
      },
    };
    const original = structuredClone(enriched);

    expect(scrub(enriched)).toStrictEqual({
      uuid: captureUuid,
      event: 'order_started',
      timestamp: captureTimestamp,
      properties: {
        service: 'cleaning',
        frequency: 'monthly',
        source: 'prefill',
        token: 'phc_test',
        distinct_id: '019fdace-7e93-7182-bd9a-e046aa0958a3',
        $device_id: '019fdace-7e93-7182-bd9a-e046aa0958a3',
        $session_id: '019fdace-7ea1-7585-af86-620e0304007e',
        $window_id: '019fdace-7ea1-7585-af86-620f559a00ac',
        $lib: 'web',
        $lib_version: '1.438.12',
        $insert_id: 'abcdefghijklmnop',
        $time: 1786027200.5,
        $process_person_profile: false,
        $browser: 'Mobile Safari',
        $os: 'iOS',
        $device_type: 'Mobile',
        $current_url: 'https://briancline.co/hull-cleaning/order',
        $pathname: '/hull-cleaning/order',
        $session_entry_url: 'https://briancline.co/hull-cleaning/order',
      },
    });
    expect(enriched).toStrictEqual(original);
  });

  it('drops PII-shaped identities and foreign tokens', async () => {
    const scrub = await beforeSend();
    const result = scrub({
      uuid: captureUuid,
      event: 'calculator_started',
      timestamp: captureTimestamp,
      properties: {
        service: 'cleaning',
        token: 'phc_other_project',
        distinct_id: 'ada@example.com',
        $device_id: '415-555-0123',
        $browser: 'ada@example.com',
      },
    });
    expect(result.properties).toStrictEqual({
      service: 'cleaning',
      $current_url: 'https://briancline.co/hull-cleaning/order',
      $pathname: '/hull-cleaning/order',
    });
  });

  it('drops internal or non-allowlisted SDK events and malformed results', async () => {
    const scrub = await beforeSend();
    const valid = { uuid: captureUuid, timestamp: captureTimestamp, properties: {} };
    for (const event of ['$autocapture', '$identify', '$set', '$snapshot', '$exception', '$pageleave', '$web_vitals']) {
      expect(scrub({ ...valid, event })).toBeNull();
    }
    expect(scrub(null)).toBeNull();
    expect(scrub({ ...valid, event: '$pageview', uuid: 'not-a-uuid' })).toBeNull();
    expect(scrub({ ...valid, event: '$pageview', timestamp: 'yesterday' })).toBeNull();
    expect(scrub({ ...valid, event: '$pageview', properties: [] })).toBeNull();
  });

  it('works with the installed posthog-js: events are scrubbed before emit and transport', async () => {
    const sdk = new PostHog();
    sdk._send_request = vi.fn();
    const analytics = createAnalytics({
      loadSdk: async () => sdk,
      env: { VITE_POSTHOG_KEY: 'phc_test' },
      getLocation: () => orderLocation,
      getNavigator: () => ({}),
      getWindow: () => ({}),
    });
    const captured = [];
    try {
      analytics.initialize();
      expect(await analytics.whenReady()).toBe(true);
      const unsubscribe = sdk.on('eventCaptured', (result) => captured.push(result));
      expect(analytics.capture('order_submitted', {
        service: 'cleaning', frequency: 'monthly', payment: 'card', result: 'success', customerEmail: 'ada@example.com',
      })).toBe(true);
      unsubscribe();

      expect(captured).toHaveLength(1);
      const { properties } = captured[0];
      expect(properties).toMatchObject({
        service: 'cleaning',
        frequency: 'monthly',
        payment: 'card',
        result: 'success',
        token: 'phc_test',
        $current_url: 'https://briancline.co/hull-cleaning/order',
        $process_person_profile: false,
      });
      expect(JSON.stringify(captured)).not.toMatch(/ada@example\.com|4155550123|customerEmail/);
    } finally {
      await sdk.shutdown?.();
    }
  });
});

describe('funnel buckets', () => {
  it('buckets boat length', () => {
    expect([1, 29, 30, 39, 40, 49, 50, 150].map(lengthBucket))
      .toStrictEqual(['<30', '<30', '30-39', '30-39', '40-49', '40-49', '50+', '50+']);
    expect(lengthBucket('35')).toBe('30-39');
    expect([undefined, '', 0, -3, 'abc'].map(lengthBucket)).toStrictEqual([undefined, undefined, undefined, undefined, undefined]);
  });

  it('buckets the estimate', () => {
    expect([99, 149.99, 150, 199.99, 200, 299.99, 300, 499, 500, 1200].map(estimateBucket))
      .toStrictEqual(['<150', '<150', '150-199', '150-199', '200-299', '200-299', '300-499', '300-499', '500+', '500+']);
    expect([undefined, 0, NaN, 'x'].map(estimateBucket)).toStrictEqual([undefined, undefined, undefined, undefined]);
  });

  it('normalizes the two frequency spellings and service keys', () => {
    expect(['onetime', 'one_time', 'one-time', 'monthly', 'bimonthly', 'quarterly', '', 'weekly'].map(normalizeFrequency))
      .toStrictEqual(['one_time', 'one_time', 'one_time', 'monthly', 'bimonthly', 'quarterly', 'unset', 'unset']);
    expect(['cleaning', 'recurring_cleaning', 'running_gear', 'item_recovery', 'Ada', undefined].map(normalizeServiceKey))
      .toStrictEqual(['cleaning', 'cleaning', 'running_gear', 'item_recovery', 'other', 'other']);
  });
});

describe('internal traffic flag', () => {
  const at = (search) => ({ origin: 'https://briancline.co', pathname: '/hull-cleaning', search, hash: '' });

  it('?internal=1 marks and persists, ?internal=0 clears, otherwise storage decides', () => {
    const storage = memoryStorage();
    expect(internalTrafficFlag({ location: at(''), storage })).toBe(false);
    expect(internalTrafficFlag({ location: at('?internal=1'), storage })).toBe(true);
    expect(storage.data.get('ss_internal')).toBe('1');
    expect(internalTrafficFlag({ location: at(''), storage })).toBe(true);
    expect(internalTrafficFlag({ location: at('?internal=0'), storage })).toBe(false);
    expect(storage.data.has('ss_internal')).toBe(false);
  });

  it('survives blocked storage', () => {
    const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {} };
    expect(internalTrafficFlag({ location: at('?internal=1'), storage })).toBe(true);
    expect(internalTrafficFlag({ location: at(''), storage })).toBe(false);
  });

  it('registers internal=true only for internal traffic, and before_send keeps it', async () => {
    const internalRun = setup({ location: at('?internal=1') });
    internalRun.analytics.initialize();
    await internalRun.analytics.whenReady();
    expect(internalRun.sdk.calls.registers).toStrictEqual([{ internal: true }]);

    const storedRun = setup({ location: at(''), storage: memoryStorage({ ss_internal: '1' }) });
    storedRun.analytics.initialize();
    await storedRun.analytics.whenReady();
    expect(storedRun.sdk.calls.registers).toStrictEqual([{ internal: true }]);

    const publicRun = setup({ location: at('') });
    publicRun.analytics.initialize();
    await publicRun.analytics.whenReady();
    expect(publicRun.sdk.calls.registers).toBeUndefined();
    expect(publicRun.sdk.calls.unregisters).toStrictEqual(['internal']);

    const scrub = internalRun.sdk.calls.inits[0].options.before_send;
    const out = scrub({
      uuid: captureUuid,
      event: '$pageview',
      timestamp: captureTimestamp,
      properties: { surface: 'services', internal: true, $current_url: 'https://briancline.co/hull-cleaning?internal=1' },
    });
    expect(out.properties.internal).toBe(true);
    expect(out.properties.$current_url).toBe('https://briancline.co/hull-cleaning');
    expect(scrub({ ...out, properties: { ...out.properties, internal: 'yes' } }).properties.internal).toBeUndefined();
  });

  it('?internal=0 on a previously marked browser clears the flag and unregisters the persisted property', async () => {
    const storage = memoryStorage({ ss_internal: '1' });
    const clearedRun = setup({ location: at('?internal=0'), storage });
    clearedRun.analytics.initialize();
    await clearedRun.analytics.whenReady();
    expect(storage.data.has('ss_internal')).toBe(false);
    expect(clearedRun.sdk.calls.registers).toBeUndefined();
    expect(clearedRun.sdk.calls.unregisters).toStrictEqual(['internal']);
  });
});
