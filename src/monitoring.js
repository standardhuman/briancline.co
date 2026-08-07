const sensitiveKey = /email|phone|name|message|notes|token|authorization|cookie|body|query|form|customer|recipient|address|payment|card/i;

const allowedTagValues = {
  surface: new Set(['landing', 'services', 'email-api']),
  runtime: new Set(['browser', 'server']),
  endpoint: new Set(['contact', 'delivery-inquiry', 'detailing-estimate']),
  stage: new Set(['browser-runtime', 'resend-send']),
};

const initializedRuntimeSdks = new WeakSet();

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function redactText(value) {
  if (typeof value !== 'string') return value;

  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\bBearer\s+[A-Z0-9._~+/=-]+/gi, '[redacted-bearer]')
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, '[redacted-phone]');
}

function scrubData(value) {
  if (Array.isArray(value)) return value.map(scrubData);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveKey.test(key))
      .map(([key, nestedValue]) => [key, scrubData(nestedValue)]),
  );
}

export function sanitizeSentryTags(tags = {}) {
  return Object.fromEntries(
    Object.entries(tags).filter(([key, value]) => (
      Object.hasOwn(allowedTagValues, key)
      && allowedTagValues[key].has(value)
      && !sensitiveKey.test(key)
    )),
  );
}

export function scrubSentryEvent(event) {
  const scrubbed = { ...event };

  delete scrubbed.user;
  delete scrubbed.request;

  if (Object.hasOwn(scrubbed, 'message')) scrubbed.message = redactText(scrubbed.message);
  if (Object.hasOwn(scrubbed, 'extra')) scrubbed.extra = scrubData(scrubbed.extra);
  if (Object.hasOwn(scrubbed, 'contexts')) scrubbed.contexts = scrubData(scrubbed.contexts);
  if (Object.hasOwn(scrubbed, 'tags')) scrubbed.tags = sanitizeSentryTags(scrubbed.tags);

  if (Array.isArray(scrubbed.breadcrumbs)) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs.map((breadcrumb) => (
      breadcrumb && typeof breadcrumb === 'object' && Object.hasOwn(breadcrumb, 'data')
        ? { ...breadcrumb, data: scrubData(breadcrumb.data) }
        : breadcrumb
    ));
  }

  if (Array.isArray(scrubbed.exception?.values)) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map((exception) => (
        exception && typeof exception === 'object' && Object.hasOwn(exception, 'value')
          ? { ...exception, value: redactText(exception.value) }
          : exception
      )),
    };
  }

  return scrubbed;
}

export function createBrowserMonitoring({ sdk, env = {} }) {
  const dsn = trimmed(env.VITE_SENTRY_DSN);
  let initialized = false;

  function initialize() {
    if (!dsn) return false;
    if (initialized) return true;

    if (initializedRuntimeSdks.has(sdk)) {
      initialized = true;
      return true;
    }

    const environment = trimmed(env.VITE_VERCEL_ENV) || trimmed(env.MODE) || 'development';
    const release = trimmed(env.VITE_VERCEL_GIT_COMMIT_SHA);
    const options = {
      dsn,
      environment,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      beforeSend: scrubSentryEvent,
    };

    if (release) options.release = release;
    sdk.init(options);
    initializedRuntimeSdks.add(sdk);
    initialized = true;
    return true;
  }

  return {
    captureException(exception, tags = {}) {
      if (!initialize()) return false;

      sdk.withScope((scope) => {
        scope.setTags(sanitizeSentryTags({ ...tags, runtime: 'browser' }));
        sdk.captureException(exception);
      });
      return true;
    },
  };
}
