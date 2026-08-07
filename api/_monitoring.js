import { sanitizeSentryTags, scrubSentryEvent } from '../src/monitoring.js';

const initializedRuntimeSdks = new WeakSet();

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function createServerMonitoring({ sdk, env = {} }) {
  const dsn = trimmed(env.SENTRY_DSN);
  let initialized = false;

  function initialize() {
    if (!dsn) return false;
    if (initialized) return true;

    if (initializedRuntimeSdks.has(sdk)) {
      initialized = true;
      return true;
    }

    const environment = trimmed(env.VERCEL_ENV) || trimmed(env.NODE_ENV) || 'development';
    const release = trimmed(env.VERCEL_GIT_COMMIT_SHA);
    const options = {
      dsn,
      environment,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      includeLocalVariables: false,
      beforeSend: scrubSentryEvent,
    };

    if (release) options.release = release;
    sdk.init(options);
    initializedRuntimeSdks.add(sdk);
    initialized = true;
    return true;
  }

  return {
    async captureException(exception, tags = {}) {
      if (!initialize()) return false;

      sdk.withScope((scope) => {
        scope.setTags(sanitizeSentryTags({ ...tags, runtime: 'server' }));
        sdk.captureException(exception);
      });
      await sdk.flush(2000);
      return true;
    },
  };
}
