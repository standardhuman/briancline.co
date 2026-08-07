const sensitiveKey = /email|phone|name|message|notes|token|authorization|cookie|body|query|form|customer|recipient|address|payment|card/i;

const allowedTagValues = {
  surface: new Set(['landing', 'services', 'email-api']),
  runtime: new Set(['browser', 'server']),
  endpoint: new Set(['contact', 'delivery-inquiry', 'detailing-estimate']),
  stage: new Set(['browser-runtime', 'resend-send']),
};

const initializedRuntimeSdks = new WeakSet();
const phoneLike = /(?<!\d)(?:\+?1[\s()._~\/-]*)?\(?\d{3}\)?[\s()._~\/-]*\d{3}[\s()._~\/-]*\d{4}(?!\d)/;
const jwtLike = /\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{4,}\b/;
const commonSecret = /\b(?:(?:AKIA|ASIA)[A-Z0-9]{16}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|re_[A-Za-z0-9_-]{24,}|github_pat_[A-Za-z0-9_]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|(?:token|jwt|secret|api[_-]?key)\s*[:=._-]\s*[A-Za-z0-9._~+/-]{6,})\b/i;

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function redactText(value) {
  if (typeof value !== 'string') return value;

  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\bBearer\s+[A-Z0-9._~+/=-]+/gi, '[redacted-bearer]')
    .replace(new RegExp(jwtLike.source, 'g'), '[redacted-token]')
    .replace(new RegExp(commonSecret.source, 'gi'), '[redacted-token]')
    .replace(new RegExp(phoneLike.source, 'g'), '[redacted-phone]');
}

function scrubData(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(scrubData);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveKey.test(key))
      .map(([key, nestedValue]) => [key, scrubData(nestedValue)]),
  );
}

function hasSensitivePathContent(value) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)
    || /\bBearer\s+[A-Z0-9._~+/=-]+/i.test(value)
    || phoneLike.test(value)
    || jwtLike.test(value)
    || commonSecret.test(value);
}

function pathOnlyUrl(value) {
  if (typeof value !== 'string') return undefined;

  try {
    const url = new URL(value, 'https://redacted.invalid');
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    const pathname = url.pathname || '/';
    let decodedPathname = pathname;

    for (let pass = 0; pass < 3; pass += 1) {
      const nextPathname = decodeURIComponent(decodedPathname);
      if (nextPathname === decodedPathname) {
        return hasSensitivePathContent(decodedPathname) ? undefined : pathname;
      }
      decodedPathname = nextPathname;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function scrubBreadcrumb(breadcrumb) {
  if (!breadcrumb || typeof breadcrumb !== 'object') return breadcrumb;

  const scrubbed = { ...breadcrumb };
  if (breadcrumb.category === 'console') {
    delete scrubbed.message;
  } else if (Object.hasOwn(breadcrumb, 'message')) {
    if (typeof breadcrumb.message === 'string') scrubbed.message = redactText(breadcrumb.message);
    else delete scrubbed.message;
  }

  if (Object.hasOwn(breadcrumb, 'data')) {
    const data = scrubData(breadcrumb.data);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      delete scrubbed.data;
      return scrubbed;
    }

    if (breadcrumb.category === 'console') delete data.arguments;
    for (const key of ['from', 'to', 'url']) {
      if (!Object.hasOwn(data, key)) continue;
      const pathname = pathOnlyUrl(breadcrumb.data[key]);
      if (pathname === undefined) delete data[key];
      else data[key] = pathname;
    }
    scrubbed.data = data;
  }

  return scrubbed;
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
    scrubbed.breadcrumbs = scrubbed.breadcrumbs.map(scrubBreadcrumb);
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

  function ensureInitialized() {
    if (!dsn) return false;
    if (initialized) return true;

    try {
      if (!initializedRuntimeSdks.has(sdk)) {
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
      }
      initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  return {
    initialize(defaultTags = {}) {
      if (!ensureInitialized()) return false;

      try {
        sdk.setTags(sanitizeSentryTags({ ...defaultTags, runtime: 'browser' }));
        return true;
      } catch {
        return false;
      }
    },
    captureException(exception, tags = {}) {
      if (!ensureInitialized()) return false;

      try {
        sdk.withScope((scope) => {
          scope.setTags(sanitizeSentryTags({ ...tags, runtime: 'browser' }));
          sdk.captureException(exception);
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}
