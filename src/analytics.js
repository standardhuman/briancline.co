const allowedEvents = new Set([
  '$pageview',
  'service_viewed',
  'contact_started',
  'contact_submitted',
  'checkout_started',
  'checkout_redirected',
  'checkout_failed',
]);

const allowedPropertyKeys = new Set([
  'service',
  'surface',
  'step',
  'result',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'referrer',
]);

const allowedPropertyValues = {
  surface: new Set(['landing', 'services']),
  step: new Set(['form', 'submit', 'payment-intent', 'stripe-confirmation']),
  result: new Set(['started', 'success', 'failed']),
};

const attributionKeys = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
];

const sourceServices = new Map([
  ['cleaning', 'hull-cleaning'],
  ['recurring_cleaning', 'hull-cleaning'],
  ['diving', 'hull-cleaning'],
  ['underwater_inspection', 'hull-cleaning'],
  ['detailing', 'boat-detailing'],
  ['training', 'sailing-lessons'],
  ['item_recovery', 'item-recovery'],
  ['propeller_service', 'propeller-service'],
  ['anodes_only', 'anodes-only'],
]);

const allowedServices = new Set([
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
  'unknown',
]);

const initializedRuntimeSdks = new WeakSet();
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

function sanitizeProperties(properties) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {};

  const sanitized = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!allowedPropertyKeys.has(key) || typeof value !== 'string') continue;

    if (key === 'service') {
      sanitized.service = normalizeService(value);
      continue;
    }

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

  return sanitized;
}

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

export function normalizeService(value) {
  if (typeof value !== 'string') return 'unknown';

  let candidate = value.replace(controlCharacters, '').trim().toLowerCase();
  if (!candidate) return 'unknown';

  try {
    if (/^https?:\/\//.test(candidate)) candidate = new URL(candidate).pathname;
  } catch {
    return 'unknown';
  }

  candidate = candidate.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '');
  if (!candidate) return value.trim() === '/' ? 'landing' : 'unknown';

  const firstSegment = candidate.split('/', 1)[0];
  const normalized = sourceServices.get(firstSegment) || firstSegment;
  return allowedServices.has(normalized) ? normalized : 'unknown';
}

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

export function createAnalytics({
  sdk,
  env = {},
  getLocation = () => globalThis.location,
}) {
  const key = trimmed(env.VITE_POSTHOG_KEY);
  const apiHost = trimmed(env.VITE_POSTHOG_HOST) || 'https://us.i.posthog.com';
  let initialized = false;

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

      const currentUrl = runtimeUrl();
      if (!currentUrl) return null;

      const sessionEntryUrl = Object.hasOwn(captureResult.properties, '$session_entry_url')
        ? safeAbsoluteUrl(captureResult.properties.$session_entry_url)
        : '';
      const properties = {
        ...sanitizeSdkProperties(captureResult.properties, key),
        $current_url: currentUrl,
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

  function ensureInitialized() {
    if (!key) return false;
    if (initialized) return true;

    try {
      if (!initializedRuntimeSdks.has(sdk)) {
        const result = sdk.init(key, {
          api_host: apiHost,
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
          get_current_url: runtimeUrl,
          before_send: scrubEnrichedEvent,
        });
        if (result && typeof result.catch === 'function') result.catch(() => {});
        initializedRuntimeSdks.add(sdk);
      }
      initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  return {
    initialize: ensureInitialized,
    capture(event, properties = {}) {
      if (!allowedEvents.has(event) || !ensureInitialized()) return false;

      try {
        const sanitized = sanitizeProperties(properties);
        if (event === '$pageview') {
          const currentUrl = runtimeUrl();
          if (currentUrl) sanitized.$current_url = currentUrl;
        }

        const result = sdk.capture(event, sanitized);
        if (result && typeof result.catch === 'function') result.catch(() => {});
        return true;
      } catch {
        return false;
      }
    },
  };
}
