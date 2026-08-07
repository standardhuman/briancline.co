import { describe, expect, it } from 'vitest';
import { createBrowserMonitoring } from '../src/monitoring.js';
import { createServerMonitoring } from '../api/_monitoring.js';

function createSdk() {
  const calls = { captures: [], flushes: [], globalTags: [], inits: [], scopes: [] };

  return {
    calls,
    init(options) {
      calls.inits.push(options);
    },
    setTags(tags) {
      calls.globalTags.push(tags);
    },
    withScope(callback) {
      const tags = {};
      calls.scopes.push(tags);
      callback({
        setTags(nextTags) {
          Object.assign(tags, nextTags);
        },
      });
    },
    captureException(exception) {
      calls.captures.push({ exception, tags: calls.scopes.at(-1) });
    },
    async flush(timeout) {
      calls.flushes.push(timeout);
      return true;
    },
  };
}

describe('browser monitoring privacy contract', () => {
  it('does not initialize or capture when the browser DSN is absent', () => {
    const sdk = createSdk();
    const monitoring = createBrowserMonitoring({ sdk, env: { MODE: 'production' } });

    expect(monitoring.initialize({ surface: 'landing', stage: 'browser-runtime' })).toBe(false);
    expect(monitoring.captureException(new Error('browser failure'), { surface: 'landing' })).toBe(false);
    expect(sdk.calls).toStrictEqual({ captures: [], flushes: [], globalTags: [], inits: [], scopes: [] });
  });

  it('maps trimmed browser deployment values and initializes once with safe automatic-event tags', () => {
    const sdk = createSdk();
    const monitoring = createBrowserMonitoring({
      sdk,
      env: {
        VITE_SENTRY_DSN: ' https://public@example.ingest.sentry.io/1 ',
        VITE_VERCEL_ENV: ' preview ',
        VITE_VERCEL_GIT_COMMIT_SHA: ' abc123 ',
        MODE: 'development',
      },
    });
    const first = new TypeError('first failure');
    const second = new Error('second failure');

    expect(monitoring.initialize({
      surface: 'landing',
      stage: 'browser-runtime',
      email: 'ada@example.com',
    })).toBe(true);
    expect(monitoring.captureException(first, { surface: 'landing', email: 'ada@example.com' })).toBe(true);
    expect(monitoring.captureException(second, { surface: 'services', token: 'secret' })).toBe(true);

    expect(sdk.calls.inits).toHaveLength(1);
    expect(sdk.calls.inits[0]).toMatchObject({
      dsn: 'https://public@example.ingest.sentry.io/1',
      environment: 'preview',
      release: 'abc123',
      sendDefaultPii: false,
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });
    expect(typeof sdk.calls.inits[0].beforeSend).toBe('function');
    expect(sdk.calls.globalTags).toStrictEqual([{
      surface: 'landing',
      stage: 'browser-runtime',
      runtime: 'browser',
    }]);
    expect(sdk.calls.captures).toStrictEqual([
      { exception: first, tags: { surface: 'landing', runtime: 'browser' } },
      { exception: second, tags: { surface: 'services', runtime: 'browser' } },
    ]);
  });

  it('fails closed when browser initialization throws during app startup', () => {
    const sdk = createSdk();
    sdk.init = () => {
      throw new Error('Sentry init failed');
    };
    const monitoring = createBrowserMonitoring({ sdk, env: { VITE_SENTRY_DSN: 'dsn' } });

    expect(() => monitoring.initialize({ surface: 'landing', stage: 'browser-runtime' })).not.toThrow();
    expect(monitoring.initialize({ surface: 'landing', stage: 'browser-runtime' })).toBe(false);
    expect(monitoring.captureException(new Error('app still runs'))).toBe(false);
  });

  it('uses MODE then development and omits a blank browser release', () => {
    const sdk = createSdk();
    const staging = createBrowserMonitoring({
      sdk,
      env: { VITE_SENTRY_DSN: 'dsn', VITE_VERCEL_ENV: ' ', MODE: 'staging', VITE_VERCEL_GIT_COMMIT_SHA: ' ' },
    });

    staging.captureException(new Error('staging failure'));

    expect(sdk.calls.inits[0].environment).toBe('staging');
    expect(sdk.calls.inits[0]).not.toHaveProperty('release');

    const fallbackSdk = createSdk();
    createBrowserMonitoring({ sdk: fallbackSdk, env: { VITE_SENTRY_DSN: 'dsn' } }).captureException(new Error('local failure'));
    expect(fallbackSdk.calls.inits[0].environment).toBe('development');
  });

  it('initializes only once when two browser factories share a runtime SDK', () => {
    const sdk = createSdk();
    const env = { VITE_SENTRY_DSN: 'dsn', MODE: 'production' };
    const first = createBrowserMonitoring({ sdk, env });
    const second = createBrowserMonitoring({ sdk, env });

    first.captureException(new Error('first browser failure'));
    second.captureException(new Error('second browser failure'));

    expect(sdk.calls.inits).toHaveLength(1);
    expect(sdk.calls.captures).toHaveLength(2);
  });

  it('removes personal fields and redacts secret-bearing text without changing exception type or frames', () => {
    const sdk = createSdk();
    const monitoring = createBrowserMonitoring({ sdk, env: { VITE_SENTRY_DSN: 'dsn' } });
    monitoring.captureException(new Error('initialize'));
    const beforeSend = sdk.calls.inits[0].beforeSend;

    const event = {
      message: 'Contact ada@example.com using Bearer abc.def-123 or 415-555-0123',
      user: { id: 'user_123', email: 'ada@example.com' },
      request: { url: 'https://example.com', headers: { cookie: 'session=secret' } },
      extra: { safe: 'kept', email: 'ada@example.com', nested: { notes: 'private', safe: 'still kept' } },
      contexts: { app: { safe: 'kept' }, customer: { id: 'customer_123' } },
      breadcrumbs: [{ category: 'ui.click', data: { action: 'submit', body: 'private form' } }],
      tags: { surface: 'landing', runtime: 'browser', endpoint: 'contact', stage: 'browser-runtime', email: 'ada@example.com', other: 'drop me' },
      exception: {
        values: [{
          type: 'ProviderError',
          value: 'Recipient ada@example.com rejected Bearer abc.def-123 at 415 555 0123',
          stacktrace: { frames: [{ filename: 'api/contact.js', function: 'handler', lineno: 42 }] },
        }],
      },
    };

    expect(beforeSend(event)).toStrictEqual({
      message: 'Contact [redacted-email] using [redacted-bearer] or [redacted-phone]',
      extra: { safe: 'kept', nested: { safe: 'still kept' } },
      contexts: { app: { safe: 'kept' } },
      breadcrumbs: [{ category: 'ui.click', data: { action: 'submit' } }],
      tags: { surface: 'landing', runtime: 'browser', endpoint: 'contact', stage: 'browser-runtime' },
      exception: {
        values: [{
          type: 'ProviderError',
          value: 'Recipient [redacted-email] rejected [redacted-bearer] at [redacted-phone]',
          stacktrace: { frames: [{ filename: 'api/contact.js', function: 'handler', lineno: 42 }] },
        }],
      },
    });
  });

  it('removes secrets from navigation and console breadcrumbs without mutating the captured event', () => {
    const sdk = createSdk();
    const monitoring = createBrowserMonitoring({ sdk, env: { VITE_SENTRY_DSN: 'dsn' } });
    monitoring.captureException(new Error('initialize'));
    const beforeSend = sdk.calls.inits[0].beforeSend;
    const event = {
      breadcrumbs: [
        {
          category: 'navigation',
          message: 'Opening order for ada@example.com with Bearer order-token',
          data: {
            from: 'https://briancline.co/services?customerEmail=ada%40example.com&leadBoatId=lead-secret#details',
            to: '/order?customerPhone=415-555-0123&leadBoatId=lead-secret',
            url: 'https://briancline.co/order/confirmation?token=checkout-secret',
            status_code: 200,
          },
        },
        {
          category: 'console',
          level: 'error',
          message: 'Order failed for ada@example.com with Bearer checkout-secret',
          data: {
            arguments: [
              'Call 415-555-0123',
              { customerEmail: 'ada@example.com', leadBoatId: 'lead-secret' },
            ],
            logger: 'console',
          },
        },
        {
          category: 'ui.click',
          message: 'Contact 415-555-0123 about ada@example.com',
          data: { action: 'submit' },
        },
      ],
    };
    const original = structuredClone(event);

    expect(beforeSend(event)).toStrictEqual({
      breadcrumbs: [
        {
          category: 'navigation',
          message: 'Opening order for [redacted-email] with [redacted-bearer]',
          data: {
            from: '/services',
            to: '/order',
            url: '/order/confirmation',
            status_code: 200,
          },
        },
        {
          category: 'console',
          level: 'error',
          data: { logger: 'console' },
        },
        {
          category: 'ui.click',
          message: 'Contact [redacted-phone] about [redacted-email]',
          data: { action: 'submit' },
        },
      ],
    });
    expect(event).toStrictEqual(original);
  });

  it('drops navigation URL fields with sensitive or malformed decoded paths while retaining safe paths', () => {
    const sdk = createSdk();
    const monitoring = createBrowserMonitoring({ sdk, env: { VITE_SENTRY_DSN: 'dsn' } });
    monitoring.captureException(new Error('initialize'));
    const beforeSend = sdk.calls.inits[0].beforeSend;
    const event = {
      breadcrumbs: [
        {
          category: 'navigation',
          data: {
            from: '/orders/confirmation?customerEmail=ada%40example.com',
            to: '/ada@example.com/order',
            url: '/orders/Bearer%20secret-token',
          },
        },
        {
          category: 'navigation',
          data: {
            from: '/orders/415-555-0123',
            to: '/orders/ada%2540example.com',
            url: '/orders/Bearer%2520double-secret',
          },
        },
        {
          category: 'navigation',
          data: {
            from: '/orders/%34%31%35%2D%35%35%35%2D%30%31%32%33',
            to: '/orders/%E0%A4%A',
            url: 'https://briancline.co/orders/safe?token=query-secret',
          },
        },
      ],
    };
    const original = structuredClone(event);

    expect(beforeSend(event)).toStrictEqual({
      breadcrumbs: [
        { category: 'navigation', data: { from: '/orders/confirmation' } },
        { category: 'navigation', data: {} },
        { category: 'navigation', data: { url: '/orders/safe' } },
      ],
    });
    expect(event).toStrictEqual(original);
  });

  it('drops phone-like pathname clusters across URL separators without dropping safe numeric routes', () => {
    const sdk = createSdk();
    const monitoring = createBrowserMonitoring({ sdk, env: { VITE_SENTRY_DSN: 'dsn' } });
    monitoring.captureException(new Error('initialize'));
    const beforeSend = sdk.calls.inits[0].beforeSend;
    const event = {
      breadcrumbs: [
        {
          category: 'navigation',
          data: {
            from: '/orders/415_555_0123',
            to: '/orders/415/555/0123',
            url: '/orders/12345678',
          },
        },
        {
          category: 'navigation',
          data: {
            from: '/orders/415%5F555%5F0123',
            to: '/orders/415%2F555%2F0123',
            url: '/archive/2026/08/06',
          },
        },
        {
          category: 'navigation',
          data: {
            from: '/orders/415%255F555%255F0123',
            to: '/orders/415%252F555%252F0123',
            url: '/orders/20260806/status',
          },
        },
      ],
    };
    const original = structuredClone(event);

    expect(beforeSend(event)).toStrictEqual({
      breadcrumbs: [
        { category: 'navigation', data: { url: '/orders/12345678' } },
        { category: 'navigation', data: { url: '/archive/2026/08/06' } },
        { category: 'navigation', data: { url: '/orders/20260806/status' } },
      ],
    });
    expect(event).toStrictEqual(original);
  });
});

describe('server monitoring privacy contract', () => {
  it('does not initialize, capture, or flush when the server DSN is absent', async () => {
    const sdk = createSdk();
    const monitoring = createServerMonitoring({ sdk, env: { NODE_ENV: 'production' } });

    await expect(monitoring.captureException(new Error('server failure'), { surface: 'email-api' })).resolves.toBe(false);
    expect(sdk.calls).toStrictEqual({ captures: [], flushes: [], globalTags: [], inits: [], scopes: [] });
  });

  it('maps trimmed server deployment values, captures only safe tags, and flushes for at most two seconds', async () => {
    const sdk = createSdk();
    const monitoring = createServerMonitoring({
      sdk,
      env: {
        SENTRY_DSN: ' https://secret@example.ingest.sentry.io/2 ',
        VERCEL_ENV: ' production ',
        VERCEL_GIT_COMMIT_SHA: ' def456 ',
        NODE_ENV: 'test',
      },
    });
    const exception = new TypeError('Resend failed');

    await expect(monitoring.captureException(exception, {
      surface: 'email-api',
      endpoint: 'contact',
      stage: 'resend-send',
      email: 'ada@example.com',
      authorization: 'Bearer secret',
    })).resolves.toBe(true);

    expect(sdk.calls.inits).toHaveLength(1);
    expect(sdk.calls.inits[0]).toMatchObject({
      dsn: 'https://secret@example.ingest.sentry.io/2',
      environment: 'production',
      release: 'def456',
      sendDefaultPii: false,
      tracesSampleRate: 0,
      includeLocalVariables: false,
    });
    expect(typeof sdk.calls.inits[0].beforeSend).toBe('function');
    expect(sdk.calls.captures).toStrictEqual([{
      exception,
      tags: { surface: 'email-api', endpoint: 'contact', stage: 'resend-send', runtime: 'server' },
    }]);
    expect(sdk.calls.flushes).toStrictEqual([2000]);
  });

  it('uses NODE_ENV then development and omits a blank server release', async () => {
    const sdk = createSdk();
    const monitoring = createServerMonitoring({
      sdk,
      env: { SENTRY_DSN: 'dsn', VERCEL_ENV: ' ', NODE_ENV: 'staging', VERCEL_GIT_COMMIT_SHA: ' ' },
    });

    await monitoring.captureException(new Error('staging failure'));

    expect(sdk.calls.inits[0].environment).toBe('staging');
    expect(sdk.calls.inits[0]).not.toHaveProperty('release');

    const fallbackSdk = createSdk();
    await createServerMonitoring({ sdk: fallbackSdk, env: { SENTRY_DSN: 'dsn' } }).captureException(new Error('local failure'));
    expect(fallbackSdk.calls.inits[0].environment).toBe('development');
  });

  it('initializes only once when two server factories share a runtime SDK', async () => {
    const sdk = createSdk();
    const env = { SENTRY_DSN: 'dsn', NODE_ENV: 'production' };
    const first = createServerMonitoring({ sdk, env });
    const second = createServerMonitoring({ sdk, env });

    await first.captureException(new Error('first server failure'));
    await second.captureException(new Error('second server failure'));

    expect(sdk.calls.inits).toHaveLength(1);
    expect(sdk.calls.captures).toHaveLength(2);
  });

  it('fails closed when server capture or flush rejects', async () => {
    const captureSdk = createSdk();
    captureSdk.captureException = () => {
      throw new Error('capture failed');
    };
    const flushSdk = createSdk();
    flushSdk.flush = async () => {
      throw new Error('flush failed');
    };

    await expect(createServerMonitoring({ sdk: captureSdk, env: { SENTRY_DSN: 'dsn' } })
      .captureException(new Error('provider failure'))).resolves.toBe(false);
    await expect(createServerMonitoring({ sdk: flushSdk, env: { SENTRY_DSN: 'dsn' } })
      .captureException(new Error('provider failure'))).resolves.toBe(false);
    expect(flushSdk.calls.flushes).toStrictEqual([]);
  });
});
