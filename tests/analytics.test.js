import { describe, expect, it } from 'vitest';
import {
  createAnalytics,
  normalizeService,
  safeCurrentUrl,
  sanitizeAttribution,
} from '../src/analytics.js';

const allowedEvents = [
  '$pageview',
  'service_viewed',
  'contact_started',
  'contact_submitted',
  'checkout_started',
  'checkout_redirected',
  'checkout_failed',
];

function createSdk() {
  const calls = { captures: [], inits: [] };

  return {
    calls,
    init(key, options) {
      calls.inits.push({ key, options });
    },
    capture(event, properties) {
      calls.captures.push({ event, properties });
    },
  };
}

describe('PostHog initialization contract', () => {
  it('does not initialize or capture without a nonblank project key', () => {
    const missingSdk = createSdk();
    const blankSdk = createSdk();

    const missing = createAnalytics({ sdk: missingSdk, env: {} });
    const blank = createAnalytics({ sdk: blankSdk, env: { VITE_POSTHOG_KEY: '   ' } });

    expect(missing.initialize()).toBe(false);
    expect(missing.capture('service_viewed', { service: 'marine' })).toBe(false);
    expect(blank.initialize()).toBe(false);
    expect(blank.capture('$pageview', { surface: 'landing' })).toBe(false);
    expect(missingSdk.calls).toStrictEqual({ captures: [], inits: [] });
    expect(blankSdk.calls).toStrictEqual({ captures: [], inits: [] });
  });

  it('trims the key and initializes with the exact privacy-safe defaults', () => {
    const sdk = createSdk();
    const analytics = createAnalytics({
      sdk,
      env: { VITE_POSTHOG_KEY: ' phc_project_key ' },
      getLocation: () => ({
        origin: 'https://briancline.co',
        pathname: '/marine',
        search: '?email=ada@example.com',
        hash: '#private',
      }),
    });

    expect(analytics.initialize()).toBe(true);
    expect(sdk.calls.inits).toStrictEqual([{
      key: 'phc_project_key',
      options: {
        api_host: 'https://us.i.posthog.com',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        capture_exceptions: false,
        person_profiles: 'never',
        save_campaign_params: false,
        save_referrer: false,
        respect_dnt: true,
        disable_capture_url_hashes: true,
        mask_personal_data_properties: true,
        get_current_url: expect.any(Function),
        before_send: expect.any(Function),
      },
    }]);
    expect(sdk.calls.inits[0].options.get_current_url('https://briancline.co/marine?token=secret#private'))
      .toBe('https://briancline.co/marine');
  });

  it('scrubs SDK-enriched URLs without mutating service, contact, or checkout events', () => {
    const sdk = createSdk();
    const analytics = createAnalytics({
      sdk,
      env: { VITE_POSTHOG_KEY: 'key' },
      getLocation: () => ({
        origin: 'https://briancline.co',
        pathname: '/hull-cleaning/order',
        search: '?email=ada@example.com',
        hash: '#payment',
      }),
    });
    analytics.initialize();
    const beforeSend = sdk.calls.inits[0].options.before_send;

    for (const [event, customProperties] of [
      ['service_viewed', { service: 'hull-cleaning', surface: 'services' }],
      ['contact_submitted', { surface: 'landing', step: 'submit', result: 'success' }],
      ['checkout_redirected', { service: 'hull-cleaning', step: 'stripe-confirmation', result: 'started' }],
    ]) {
      const enriched = {
        uuid: `uuid-${event}`,
        event,
        timestamp: new Date('2026-08-06T12:00:00.000Z'),
        properties: {
          ...customProperties,
          $current_url: 'https://briancline.co/hull-cleaning/order?email=ada@example.com#payment',
          $referrer: 'https://search.example/private?q=ada@example.com',
          $initial_referrer: 'https://partner.example/secret/path',
          $session_entry_url: 'https://briancline.co/hull-cleaning/order?email=ada@example.com#payment',
          $session_entry_referrer: 'https://partner.example/private/path?email=ada@example.com',
          $session_entry_utm_source: 'private-source',
          $session_entry_utm_medium: 'private-medium',
          $session_entry_utm_campaign: 'private-campaign',
          $session_entry_utm_content: 'private-content',
          $session_entry_utm_term: 'private-term',
          $session_entry_ph_keyword: 'ada@example.com',
          $session_entry_mc_cid: 'private-mailchimp-id',
          $session_entry_gclid: 'private-google-click-id',
          $initial_current_url: 'https://briancline.co/hull-cleaning/order?email=ada@example.com#payment',
          $initial_referrer_info: {
            referrer: 'https://partner.example/private/path',
            referring_domain: 'partner.example',
          },
          $initial_ph_keyword: 'ada@example.com',
          $initial_mc_cid: 'private-mailchimp-id',
          ph_keyword: 'ada@example.com',
          mc_cid: 'private-mailchimp-id',
          gclid: 'private-google-click-id',
          utm_source: 'ada@example.com',
          utm_medium: '415_555_0123',
          utm_campaign: 'summer-sale',
          utm_content: 'secret-abcdefghijklmnopqrstuvwxyz',
          utm_term: 'sailing',
          token: 'phc_internal_project_token',
          distinct_id: 'distinct_internal',
          $lib: 'web',
          $lib_version: '1.413.3',
          $device_id: 'device_internal',
          $session_id: 'session_internal',
          $window_id: 'window_internal',
        },
      };
      const originalProperties = { ...enriched.properties };

      const scrubbed = beforeSend(enriched);

      expect(scrubbed).not.toBe(enriched);
      expect(scrubbed.properties).not.toBe(enriched.properties);
      expect(scrubbed).toStrictEqual({
        ...enriched,
        properties: {
          ...customProperties,
          utm_campaign: 'summer-sale',
          utm_term: 'sailing',
          $current_url: 'https://briancline.co/hull-cleaning/order',
          $session_entry_url: 'https://briancline.co/hull-cleaning/order',
          token: 'phc_internal_project_token',
          distinct_id: 'distinct_internal',
          $lib: 'web',
          $lib_version: '1.413.3',
          $device_id: 'device_internal',
          $session_id: 'session_internal',
          $window_id: 'window_internal',
        },
      });
      expect(enriched.properties).toStrictEqual(originalProperties);
    }
  });

  it('drops malformed SDK-enriched events and fails closed when the safe URL is unavailable', () => {
    const sdk = createSdk();
    const analytics = createAnalytics({
      sdk,
      env: { VITE_POSTHOG_KEY: 'key' },
      getLocation: () => ({ origin: 'null', pathname: '/marine' }),
    });
    analytics.initialize();
    const beforeSend = sdk.calls.inits[0].options.before_send;
    const throwingProperties = {};
    Object.defineProperty(throwingProperties, '$current_url', {
      enumerable: true,
      get() {
        throw new Error('malformed properties');
      },
    });

    expect(beforeSend(null)).toBeNull();
    expect(beforeSend({ event: 'service_viewed' })).toBeNull();
    expect(beforeSend({ event: 'service_viewed', properties: [] })).toBeNull();
    expect(beforeSend({ event: 'service_viewed', properties: throwingProperties })).toBeNull();
    expect(beforeSend({
      uuid: 'uuid-service',
      event: 'service_viewed',
      properties: { service: 'marine', $current_url: 'https://briancline.co/marine?private=true' },
    })).toBeNull();
  });

  it('drops an unparseable session entry URL while preserving the rest of a valid event', () => {
    const sdk = createSdk();
    const analytics = createAnalytics({
      sdk,
      env: { VITE_POSTHOG_KEY: 'key' },
      getLocation: () => ({ origin: 'https://briancline.co', pathname: '/marine' }),
    });
    analytics.initialize();

    expect(sdk.calls.inits[0].options.before_send({
      uuid: 'uuid-service',
      event: 'service_viewed',
      properties: {
        service: 'marine',
        $current_url: 'https://briancline.co/marine?private=true',
        $session_entry_url: 'private customer entry URL',
      },
    })).toStrictEqual({
      uuid: 'uuid-service',
      event: 'service_viewed',
      properties: {
        service: 'marine',
        $current_url: 'https://briancline.co/marine',
      },
    });
  });

  it('uses a trimmed custom host and initializes only once across factories sharing a runtime SDK', () => {
    const sdk = createSdk();
    const env = {
      VITE_POSTHOG_KEY: ' project-key ',
      VITE_POSTHOG_HOST: ' https://analytics.example.test ',
    };
    const first = createAnalytics({ sdk, env });
    const second = createAnalytics({ sdk, env });

    expect(first.initialize()).toBe(true);
    expect(first.initialize()).toBe(true);
    expect(second.capture('service_viewed', { service: 'marine' })).toBe(true);

    expect(sdk.calls.inits).toHaveLength(1);
    expect(sdk.calls.inits[0].options.api_host).toBe('https://analytics.example.test');
    expect(sdk.calls.captures).toStrictEqual([{
      event: 'service_viewed',
      properties: { service: 'marine' },
    }]);
  });

  it('fails closed when SDK initialization or capture throws', () => {
    const initSdk = createSdk();
    initSdk.init = () => {
      throw new Error('PostHog init failed');
    };
    const captureSdk = createSdk();
    captureSdk.capture = () => {
      throw new Error('PostHog capture failed');
    };

    const initFailure = createAnalytics({ sdk: initSdk, env: { VITE_POSTHOG_KEY: 'key' } });
    const captureFailure = createAnalytics({ sdk: captureSdk, env: { VITE_POSTHOG_KEY: 'key' } });

    expect(() => initFailure.initialize()).not.toThrow();
    expect(initFailure.initialize()).toBe(false);
    expect(initFailure.capture('$pageview')).toBe(false);
    expect(() => captureFailure.capture('contact_started', { step: 'form' })).not.toThrow();
    expect(captureFailure.capture('contact_started', { step: 'form' })).toBe(false);
  });

  it('contains rejected SDK initialization and capture promises', async () => {
    const initSdk = createSdk();
    let initRejectionContained = false;
    initSdk.init = () => ({
      then() {},
      catch(handler) {
        initRejectionContained = typeof handler === 'function';
      },
    });
    const captureSdk = createSdk();
    captureSdk.capture = () => Promise.reject(new Error('async PostHog capture failed'));

    expect(createAnalytics({ sdk: initSdk, env: { VITE_POSTHOG_KEY: 'key' } }).initialize()).toBe(true);
    expect(initRejectionContained).toBe(true);
    expect(createAnalytics({ sdk: captureSdk, env: { VITE_POSTHOG_KEY: 'key' } })
      .capture('contact_started', { step: 'form' })).toBe(true);
    await Promise.resolve();
  });
});

describe('PostHog event and property privacy contract', () => {
  it('captures every allowed event and rejects every other event name', () => {
    const sdk = createSdk();
    const analytics = createAnalytics({ sdk, env: { VITE_POSTHOG_KEY: 'key' } });

    for (const event of allowedEvents) expect(analytics.capture(event)).toBe(true);
    expect(analytics.capture('identify', { service: 'marine' })).toBe(false);
    expect(analytics.capture('contact_message', { surface: 'landing' })).toBe(false);
    expect(analytics.capture('', { surface: 'landing' })).toBe(false);

    expect(sdk.calls.captures.map(({ event }) => event)).toStrictEqual(allowedEvents);
  });

  it('adds only the injected origin and pathname to manual pageviews', () => {
    const sdk = createSdk();
    const analytics = createAnalytics({
      sdk,
      env: { VITE_POSTHOG_KEY: 'key' },
      getLocation: () => ({
        origin: 'https://briancline.co',
        pathname: '/boat-detailing',
        search: '?email=ada@example.com',
        hash: '#contact',
      }),
    });

    analytics.capture('$pageview', {
      surface: 'services',
      $current_url: 'https://attacker.example/private?token=secret',
    });

    expect(sdk.calls.captures).toStrictEqual([{
      event: '$pageview',
      properties: {
        surface: 'services',
        $current_url: 'https://briancline.co/boat-detailing',
      },
    }]);
  });

  it('keeps only allowed keys and values while rejecting PII, free text, and nested or scalar nonstrings', () => {
    const sdk = createSdk();
    const analytics = createAnalytics({ sdk, env: { VITE_POSTHOG_KEY: 'key' } });

    expect(analytics.capture('checkout_redirected', {
      service: '/hull-cleaning/order?promo=SECRET#payment',
      surface: 'services',
      step: 'stripe-confirmation',
      result: 'started',
      utm_source: ' newsletter\u0000-2026 ',
      utm_medium: 'paid search',
      utm_campaign: `campaign-${'x'.repeat(100)}`,
      utm_content: ['nested'],
      utm_term: false,
      referrer: 'https://News.Example.com/private/path?email=ada@example.com',
      email: 'ada@example.com',
      phone: '415-555-0123',
      message: 'Please call me',
      order_number: 'order_123',
      boat: { name: 'Private vessel' },
      amount: 349,
      consent: true,
    })).toBe(true);

    expect(sdk.calls.captures).toStrictEqual([{
      event: 'checkout_redirected',
      properties: {
        service: 'hull-cleaning',
        surface: 'services',
        step: 'stripe-confirmation',
        result: 'started',
        utm_source: 'newsletter-2026',
        utm_campaign: `campaign-${'x'.repeat(71)}`,
        referrer: 'news.example.com',
      },
    }]);
  });

  it('drops invalid enum values and unsafe strings instead of coercing them', () => {
    const sdk = createSdk();
    const analytics = createAnalytics({ sdk, env: { VITE_POSTHOG_KEY: 'key' } });

    analytics.capture('contact_submitted', {
      service: { pathname: '/marine' },
      surface: 'admin',
      step: 'email',
      result: 'maybe',
      utm_source: 'ada@example.com',
      utm_medium: '415-555-0123',
      utm_campaign: 'Bearer-secret',
      referrer: 'not a URL',
    });

    expect(sdk.calls.captures).toStrictEqual([{
      event: 'contact_submitted',
      properties: {},
    }]);
  });

  it('rejects separated phone digits, JWTs, and customer identifier tokens while preserving valid UTM truncation', () => {
    const sdk = createSdk();
    const analytics = createAnalytics({ sdk, env: { VITE_POSTHOG_KEY: 'key' } });

    analytics.capture('service_viewed', {
      service: 'marine',
      utm_source: '415_555_0123',
      utm_medium: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature',
      utm_campaign: 'customer123456789',
      utm_content: 'customer_abcdefghijkl',
      utm_term: 'spring-cus_abcdefgh',
    });
    analytics.capture('service_viewed', {
      service: 'marine',
      utm_content: `valid-${'x'.repeat(100)}`,
    });

    expect(sdk.calls.captures).toStrictEqual([
      {
        event: 'service_viewed',
        properties: { service: 'marine' },
      },
      {
        event: 'service_viewed',
        properties: {
          service: 'marine',
          utm_content: `valid-${'x'.repeat(74)}`,
        },
      },
    ]);
  });

  it('rejects vanity phones and common secret prefixes while preserving a valid dated campaign label', () => {
    const sdk = createSdk();
    const analytics = createAnalytics({ sdk, env: { VITE_POSTHOG_KEY: 'key' } });

    analytics.capture('service_viewed', {
      service: 'marine',
      utm_source: '1-800-FLOWERS',
      utm_medium: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi',
      utm_content: 'secret-abcdefghijklmnopqrstuvwxyz',
      utm_campaign: 'summer-sale-2026-08-06',
    });

    expect(sdk.calls.captures).toStrictEqual([{
      event: 'service_viewed',
      properties: {
        service: 'marine',
        utm_campaign: 'summer-sale-2026-08-06',
      },
    }]);
  });
});

describe('safe analytics helpers', () => {
  it('returns only origin and pathname for a current browser URL', () => {
    expect(safeCurrentUrl({
      origin: 'https://briancline.co',
      pathname: '/hull-cleaning/order',
      search: '?email=ada@example.com',
      hash: '#card',
    })).toBe('https://briancline.co/hull-cleaning/order');
    expect(safeCurrentUrl({ origin: 'null', pathname: '/marine' })).toBe('');
    expect(safeCurrentUrl()).toBe('');
  });

  it('normalizes pathnames and known source values to the service allowlist', () => {
    expect([
      '/',
      '/marine/',
      '/hull-cleaning/order',
      '/boat-detailing',
      '/sailing-lessons/faq',
      '/deliveries',
      '/terms',
      '/privacy',
      '/recurring-authorization',
      'item_recovery',
      'propeller_service',
      'anodes_only',
      'recurring_cleaning',
      '/private-customer-path',
      null,
    ].map(normalizeService)).toStrictEqual([
      'landing',
      'marine',
      'hull-cleaning',
      'boat-detailing',
      'sailing-lessons',
      'deliveries',
      'terms',
      'privacy',
      'recurring-authorization',
      'item-recovery',
      'propeller-service',
      'anodes-only',
      'hull-cleaning',
      'unknown',
      'unknown',
    ]);
  });

  it('extracts only filtered UTM parameters and a referrer hostname', () => {
    const attribution = sanitizeAttribution({
      search: '?utm_source=Newsletter%00-2026&utm_medium=email&utm_campaign=summer_sale&utm_content=top-banner&utm_term=sailing&email=ada%40example.com&gclid=secret',
      referrer: 'https://Partner.Example.com/private/path?contact=ada@example.com#profile',
    });

    expect(attribution).toStrictEqual({
      utm_source: 'Newsletter-2026',
      utm_medium: 'email',
      utm_campaign: 'summer_sale',
      utm_content: 'top-banner',
      utm_term: 'sailing',
      referrer: 'partner.example.com',
    });

    const sdk = createSdk();
    const analytics = createAnalytics({ sdk, env: { VITE_POSTHOG_KEY: 'key' } });
    analytics.capture('$pageview', attribution);
    expect(sdk.calls.captures[0].properties.referrer).toBe('partner.example.com');

    expect(sanitizeAttribution({
      search: '?utm_source=personal%20message&utm_medium=415-555-0123&utm_campaign=%5Bprivate%5D&utm_content=&utm_term=false',
      referrer: 'private-note',
    })).toStrictEqual({ utm_term: 'false' });
  });
});
