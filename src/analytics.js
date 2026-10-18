/**
 * PostHog funnel analytics for briancline.co.
 *
 * Privacy-first wrapper: call sites never import posthog-js directly, and every
 * event passes three gates before it leaves the browser:
 *   1. an event-name allowlist (anything else is dropped),
 *   2. a property-key AND property-value allowlist (no free text, no PII),
 *   3. a `before_send` hook that rebuilds each SDK-enriched event from a small
 *      set of validated fields and strips query strings and hashes from URLs
 *      (order links can carry a name, email or phone in the query string).
 *
 * Configuration (Vite env, set on the Vercel project):
 *   VITE_POSTHOG_KEY   Required to enable. PostHog project API key. When unset
 *                      (local dev, tests, any build without it) this module
 *                      never loads posthog-js and every call is a no-op.
 *   VITE_POSTHOG_HOST  Optional ingestion host. Defaults to
 *                      https://us.i.posthog.com.
 *
 * Analytics is also skipped (posthog-js is never even downloaded) when:
 *   - the page is being prerendered (scripts/prerender.mjs sets
 *     window.__BC_PRERENDER__, and Playwright sets navigator.webdriver), or
 *   - the visitor sends Do Not Track or Global Privacy Control.
 *
 * posthog-js is loaded lazily via the injected `loadSdk` (a dynamic import), so
 * it is not part of the initial bundle and is never referenced from the
 * prerendered HTML. Events captured before it finishes loading are queued.
 */

export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

export const ANALYTICS_EVENTS = Object.freeze([
  '$pageview',
  'calculator_started',
  'calculator_completed',
  'order_started',
  'order_submitted',
  'order_failed',
]);

const allowedEvents = new Set(ANALYTICS_EVENTS);

export const SERVICE_KEYS = Object.freeze([
  'cleaning',
  'running_gear',
  'underwater_inspection',
  'item_recovery',
  'propeller_service',
  'anodes_only',
]);

const allowedPropertyValues = {
  surface: new Set(['landing', 'services']),
  service: new Set([...SERVICE_KEYS, 'other']),
  frequency: new Set(['monthly', 'bimonthly', 'quarterly', 'one_time', 'unset']),
  boat_type: new Set(['sailboat', 'powerboat']),
  hull: new Set(['monohull', 'catamaran', 'trimaran']),
  length_bucket: new Set(['<30', '30-39', '40-49', '50+']),
  estimate_bucket: new Set(['<150', '150-199', '200-299', '300-499', '500+']),
  trigger: new Set(['estimate', 'get_started']),
  source: new Set(['estimator', 'direct', 'prefill']),
  payment: new Set(['card', 'invoice']),
  step: new Set(['payment-intent', 'stripe-confirmation', 'invoice-record']),
  result: new Set(['success', 'failed']),
};

const attributionKeys = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
];

const allowedPropertyKeys = new Set([
  ...Object.keys(allowedPropertyValues),
  ...attributionKeys,
  'referrer',
]);

const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/g;
const conservativeLabel = /^[A-Za-z0-9._~-]+$/;
const likelyPhoneOrDigitCluster = /(?:\d[._~()+ -]*){7,}/;
const vanityPhone = /(?:^|[._~-])1?[._~-]?(?:800|888|877|866|855|844|833)[._~-]?[A-Za-z]{4,}(?:$|[._~-])/i;
const jwtLike = /[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/;
const tokenLike = /(?:^|[._~-])(?:bearer|token|jwt)[._~-]?[A-Za-z0-9_-]{6,}/i;
const commonSecretPrefix = /(?:^|[._~-])(?:gh[pousr]|github_pat|xox[baprs]|akia|asia|secret|api[_-]?key)[._~-]?[A-Za-z0-9_-]{8,}/i;
const customerIdentifier = /(?:customer|cus)[._~-]?[A-Za-z0-9_-]{8,}/i;
const sensitiveValuePrefix = /^(?:bearer|cus|pi|pm|tok|sk|pk|order)[._~-]/i;
const sdkUuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sdkEventUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sdkInsertId = /^[a-z0-9]{16}$/;
const sdkVersion = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/;
const coarseDeviceLabel = /^[A-Za-z][A-Za-z0-9 ._-]{0,39}$/;
const MAX_QUEUED_EVENTS = 50;

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeLabel(value, maxLength = 80) {
  if (typeof value !== 'string') return '';

  const sanitized = value.replace(controlCharacters, '').trim();
  const withoutIsoDates = sanitized.replace(/(?:^|[._~-])\d{4}-\d{2}-\d{2}(?=$|[._~-])/g, '');
  if (
    !sanitized
    || !conservativeLabel.test(sanitized)
    || likelyPhoneOrDigitCluster.test(withoutIsoDates)
    || vanityPhone.test(sanitized)
    || jwtLike.test(sanitized)
    || tokenLike.test(sanitized)
    || commonSecretPrefix.test(sanitized)
    || customerIdentifier.test(sanitized)
    || sensitiveValuePrefix.test(sanitized)
  ) return '';

  return sanitized.slice(0, maxLength);
}

function referrerHostname(value) {
  if (typeof value !== 'string') return '';

  const sanitized = value.replace(controlCharacters, '').trim();

  try {
    const url = new URL(sanitized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.hostname.toLowerCase().slice(0, 120);
  } catch {
    const isHostname = sanitized === 'localhost' || sanitized.includes('.');
    return isHostname && /^(?=.{1,120}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(sanitized)
      ? sanitized.toLowerCase()
      : '';
  }
}

/** Keep only allowlisted keys whose values are allowlisted (or safe labels for UTM). */
export function sanitizeProperties(properties) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {};

  const sanitized = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!allowedPropertyKeys.has(key) || typeof value !== 'string') continue;

    if (Object.hasOwn(allowedPropertyValues, key)) {
      const candidate = value.replace(controlCharacters, '').trim();
      if (allowedPropertyValues[key].has(candidate)) sanitized[key] = candidate;
      continue;
    }

    if (key === 'referrer') {
      const hostname = referrerHostname(value);
      if (hostname) sanitized.referrer = hostname;
      continue;
    }

    const candidate = safeLabel(value);
    if (candidate) sanitized[key] = candidate;
  }

  return sanitized;
}

function sanitizeSdkProperties(properties, key) {
  const sanitized = sanitizeProperties(properties);

  if (properties.token === key) sanitized.token = key;
  for (const property of ['distinct_id', '$device_id', '$session_id', '$window_id']) {
    if (typeof properties[property] === 'string' && sdkUuidV7.test(properties[property])) {
      sanitized[property] = properties[property];
    }
  }
  if (properties.$lib === 'web') sanitized.$lib = 'web';
  if (
    typeof properties.$lib_version === 'string'
    && properties.$lib_version.length <= 40
    && sdkVersion.test(properties.$lib_version)
  ) sanitized.$lib_version = properties.$lib_version;
  if (typeof properties.$insert_id === 'string' && sdkInsertId.test(properties.$insert_id)) {
    sanitized.$insert_id = properties.$insert_id;
  }
  if (typeof properties.$time === 'number' && Number.isFinite(properties.$time) && properties.$time >= 0) {
    sanitized.$time = properties.$time;
  }
  if (properties.$process_person_profile === false) sanitized.$process_person_profile = false;
  // Super property from register({ internal: true }); lets Brian's own visits
  // and test loops be filtered out in PostHog.
  if (properties.internal === true) sanitized.internal = true;
  // Coarse device breakdown for funnels (mobile vs desktop drop-off). Versions,
  // screen sizes, timezone and the raw user agent are fingerprinting surface and
  // are dropped.
  for (const property of ['$browser', '$os', '$device_type']) {
    if (typeof properties[property] === 'string' && coarseDeviceLabel.test(properties[property])) {
      sanitized[property] = properties[property];
    }
  }

  return sanitized;
}

/** origin + pathname only: no query string, no hash. */
export function safeCurrentUrl(location) {
  if (!location || typeof location !== 'object') return '';

  const origin = trimmed(location.origin).replace(controlCharacters, '');
  const pathname = trimmed(location.pathname).replace(controlCharacters, '');

  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') return '';
    if (!pathname.startsWith('/') || pathname.startsWith('//')) return '';

    const parsedPath = new URL(pathname, parsedOrigin.origin);
    return `${parsedOrigin.origin}${parsedPath.pathname}`;
  } catch {
    return '';
  }
}

function safeAbsoluteUrl(value) {
  if (typeof value !== 'string') return '';

  try {
    return safeCurrentUrl(new URL(value.replace(controlCharacters, '').trim()));
  } catch {
    return '';
  }
}

/** UTM parameters (as safe labels) plus the referrer hostname. Nothing else. */
export function sanitizeAttribution({ search = '', referrer = '' } = {}) {
  const attribution = {};

  try {
    const parameters = new URLSearchParams(typeof search === 'string' ? search : '');
    for (const key of attributionKeys) {
      const value = safeLabel(parameters.get(key));
      if (value) attribution[key] = value;
    }
  } catch {
    // Invalid attribution input is intentionally ignored.
  }

  const hostname = referrerHostname(referrer);
  if (hostname) attribution.referrer = hostname;

  return attribution;
}

// ── Funnel property helpers (coarse buckets, never exact customer data) ──

export function normalizeServiceKey(value) {
  if (value === 'recurring_cleaning') return 'cleaning';
  return SERVICE_KEYS.includes(value) ? value : 'other';
}

/** The estimator uses "onetime", the order form "one_time"; report one value. */
export function normalizeFrequency(value) {
  if (value === 'onetime' || value === 'one_time' || value === 'one-time') return 'one_time';
  return ['monthly', 'bimonthly', 'quarterly'].includes(value) ? value : 'unset';
}

export function lengthBucket(length) {
  const feet = Number.parseInt(length, 10);
  if (!Number.isFinite(feet) || feet <= 0) return undefined;
  if (feet < 30) return '<30';
  if (feet < 40) return '30-39';
  if (feet < 50) return '40-49';
  return '50+';
}

export function estimateBucket(amount) {
  const dollars = Number(amount);
  if (!Number.isFinite(dollars) || dollars <= 0) return undefined;
  if (dollars < 150) return '<150';
  if (dollars < 200) return '150-199';
  if (dollars < 300) return '200-299';
  if (dollars < 500) return '300-499';
  return '500+';
}

// ── Environment gates ──

/**
 * True when analytics must not run: prerender (explicit flag or an automated
 * browser), or the visitor asked not to be tracked (DNT / GPC).
 */
export function analyticsBlockedReason({ navigator: nav, window: win } = {}) {
  try {
    if (win && win.__BC_PRERENDER__ === true) return 'prerender';
    if (nav && nav.webdriver === true) return 'automation';
    const dnt = [nav?.doNotTrack, nav?.msDoNotTrack, win?.doNotTrack];
    if (dnt.some((value) => value === '1' || value === 'yes' || value === 1)) return 'do-not-track';
    if (nav && nav.globalPrivacyControl === true) return 'do-not-track';
  } catch {
    return 'unavailable';
  }
  return '';
}

export const INTERNAL_STORAGE_KEY = 'ss_internal';

/**
 * True for Brian's own and test traffic. `?internal=1` marks this browser
 * (persisted in localStorage), `?internal=0` clears it, otherwise the stored
 * `ss_internal=1` decides. Never throws: a blocked storage just reads false.
 */
export function internalTrafficFlag({ location, storage } = {}) {
  let param = null;
  try {
    param = new URLSearchParams(location?.search || '').get('internal');
  } catch {
    param = null;
  }
  try {
    if (param === '1') {
      storage?.setItem(INTERNAL_STORAGE_KEY, '1');
      return true;
    }
    if (param === '0') {
      storage?.removeItem(INTERNAL_STORAGE_KEY);
      return false;
    }
    return storage?.getItem(INTERNAL_STORAGE_KEY) === '1';
  } catch {
    return param === '1';
  }
}

/** The posthog.init config. Pure and exported so the privacy pins are tested. */
export function buildPosthogConfig({ apiHost, getCurrentUrl, beforeSend }) {
  return {
    api_host: apiHost,
    // Manual pageviews on SPA route changes; no automatic DOM capture of any
    // kind (so no form input values can ever be captured).
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    enable_heatmaps: false,
    rageclick: false,
    capture_performance: false,
    capture_exceptions: false,
    // Session recording is OFF in code. If it is ever turned on, every input
    // is masked.
    disable_session_recording: true,
    session_recording: { maskAllInputs: true },
    // Anonymous only: no person profiles, no feature-flag request (which would
    // send person properties built from the raw landing URL), no remote
    // scripts (surveys, toolbar, recorder).
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
    get_current_url: getCurrentUrl,
    before_send: beforeSend,
  };
}

/**
 * @param {object} options
 * @param {() => Promise<any>} options.loadSdk  resolves to posthog-js (module or default export)
 * @param {object} [options.env]                import.meta.env
 */
export function createAnalytics({
  loadSdk,
  env = {},
  getLocation = () => globalThis.location,
  getNavigator = () => globalThis.navigator,
  getWindow = () => globalThis.window,
  getStorage = () => globalThis.localStorage,
} = {}) {
  const key = trimmed(env?.VITE_POSTHOG_KEY);
  const apiHost = trimmed(env?.VITE_POSTHOG_HOST) || DEFAULT_POSTHOG_HOST;
  // idle -> loading -> ready, or disabled (no key, prerender, DNT, load failure)
  let state = 'idle';
  let sdk = null;
  let ready = Promise.resolve(false);
  const queue = [];

  function runtimeUrl() {
    try {
      return safeCurrentUrl(getLocation());
    } catch {
      return '';
    }
  }

  function scrubEnrichedEvent(captureResult) {
    try {
      if (
        !captureResult
        || typeof captureResult !== 'object'
        || Array.isArray(captureResult)
        || !allowedEvents.has(captureResult.event)
        || typeof captureResult.uuid !== 'string'
        || !sdkEventUuid.test(captureResult.uuid)
        || !(captureResult.timestamp instanceof Date)
        || !Number.isFinite(captureResult.timestamp.getTime())
        || !captureResult.properties
        || typeof captureResult.properties !== 'object'
        || Array.isArray(captureResult.properties)
      ) return null;

      // A queued event carries the URL it was captured on; otherwise use the
      // live location. Either way only origin + pathname survive.
      const currentUrl = safeAbsoluteUrl(captureResult.properties.$current_url) || runtimeUrl();
      if (!currentUrl) return null;

      const sessionEntryUrl = Object.hasOwn(captureResult.properties, '$session_entry_url')
        ? safeAbsoluteUrl(captureResult.properties.$session_entry_url)
        : '';
      const properties = {
        ...sanitizeSdkProperties(captureResult.properties, key),
        $current_url: currentUrl,
        $pathname: new URL(currentUrl).pathname,
      };
      if (sessionEntryUrl) properties.$session_entry_url = sessionEntryUrl;

      return {
        uuid: captureResult.uuid,
        event: captureResult.event,
        properties,
        timestamp: new Date(captureResult.timestamp.getTime()),
      };
    } catch {
      return null;
    }
  }

  function send(event, properties, timestamp) {
    try {
      const result = sdk.capture(event, properties, timestamp ? { timestamp } : undefined);
      if (result && typeof result.catch === 'function') result.catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  function initialize() {
    if (state === 'ready' || state === 'loading') return true;
    if (state === 'disabled') return false;

    let blocked = '';
    try {
      blocked = analyticsBlockedReason({ navigator: getNavigator(), window: getWindow() });
    } catch {
      blocked = 'unavailable';
    }
    if (!key || blocked || typeof loadSdk !== 'function') {
      state = 'disabled';
      queue.length = 0;
      return false;
    }

    let internal = false;
    try {
      internal = internalTrafficFlag({ location: getLocation(), storage: getStorage() });
    } catch {
      internal = false;
    }

    state = 'loading';
    ready = Promise.resolve()
      .then(() => loadSdk())
      .then((mod) => {
        const instance = mod?.default ?? mod;
        if (!instance || typeof instance.init !== 'function' || typeof instance.capture !== 'function') {
          throw new Error('posthog-js unavailable');
        }
        const initResult = instance.init(key, buildPosthogConfig({
          apiHost,
          getCurrentUrl: (defaultUrl) => safeAbsoluteUrl(defaultUrl) || runtimeUrl(),
          beforeSend: scrubEnrichedEvent,
        }));
        if (initResult && typeof initResult.catch === 'function') initResult.catch(() => {});
        // posthog-js persists super properties in its own storage, so a browser
        // un-marked with ?internal=0 must also drop the property it registered.
        if (internal) {
          if (typeof instance.register === 'function') instance.register({ internal: true });
        } else if (typeof instance.unregister === 'function') {
          instance.unregister('internal');
        }
        sdk = instance;
        state = 'ready';
        for (const item of queue.splice(0)) send(item.event, item.properties, item.timestamp);
        return true;
      })
      .catch(() => {
        state = 'disabled';
        sdk = null;
        queue.length = 0;
        return false;
      });
    return true;
  }

  return {
    initialize,
    /** Resolves true once posthog-js is loaded and initialized, false if disabled. */
    whenReady: () => ready,
    isEnabled: () => state === 'loading' || state === 'ready',
    capture(event, properties = {}) {
      if (!allowedEvents.has(event)) return false;
      if (state === 'idle') initialize();
      if (state === 'disabled') return false;

      const sanitized = sanitizeProperties(properties);
      const currentUrl = runtimeUrl();
      if (currentUrl) sanitized.$current_url = currentUrl;

      if (state === 'ready') return send(event, sanitized);
      if (queue.length >= MAX_QUEUED_EVENTS) return false;
      queue.push({ event, properties: sanitized, timestamp: new Date() });
      return true;
    },
  };
}
