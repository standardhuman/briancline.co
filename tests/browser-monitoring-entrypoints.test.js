import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createBrowserMonitoring,
  inject,
  initialize,
  posthogCapture,
  posthogInit,
  render,
  sentryCaptureBoundary,
  sentryInit,
  sentrySetTags,
  sentryWithScope,
} = vi.hoisted(() => {
  return {
    createBrowserMonitoring: vi.fn(() => ({ initialize: vi.fn() })),
    inject: vi.fn(),
    initialize: vi.fn(),
    posthogCapture: vi.fn(),
    posthogInit: vi.fn(),
    render: vi.fn(),
    sentryCaptureBoundary: vi.fn(),
    sentryInit: vi.fn(),
    sentrySetTags: vi.fn(),
    sentryWithScope: vi.fn(),
  };
});

vi.mock('@sentry/browser', () => ({
  captureException: sentryCaptureBoundary,
  init: sentryInit,
  setTags: sentrySetTags,
  withScope: sentryWithScope,
}));
vi.mock('@vercel/analytics', () => ({ inject }));
vi.mock('posthog-js/dist/module.slim', () => ({
  default: { capture: posthogCapture, init: posthogInit },
}));
vi.mock('../src/monitoring.js', () => ({ createBrowserMonitoring }));
vi.mock('react-dom/client', () => ({ createRoot: vi.fn(() => ({ render })) }));
vi.mock('../src/services/App', () => ({ default: () => null }));

const originalDocument = globalThis.document;
const originalFetch = globalThis.fetch;
const originalLocation = globalThis.location;
const originalWindow = globalThis.window;

function installBrowserGlobals() {
  const listenerTypes = [];
  const classList = { add: vi.fn(), remove: vi.fn() };

  globalThis.window = {
    addEventListener: vi.fn((type) => {
      listenerTypes.push(type);
    }),
    scrollY: 0,
  };
  globalThis.document = {
    getElementById: vi.fn((id) => {
      if (id === 'main-nav') return { classList };
      if (id === 'services-root') return { id };
      return null;
    }),
    querySelectorAll: vi.fn(() => []),
  };

  return listenerTypes;
}

async function expectEntrypointWiring(modulePath, surface) {
  const listenerTypes = installBrowserGlobals();
  createBrowserMonitoring.mockReturnValueOnce({ initialize });

  await import(modulePath);

  expect(createBrowserMonitoring).toHaveBeenCalledOnce();
  expect(createBrowserMonitoring).toHaveBeenCalledWith({
    sdk: {
      captureException: sentryCaptureBoundary,
      init: sentryInit,
      setTags: sentrySetTags,
      withScope: sentryWithScope,
    },
    env: expect.any(Object),
  });
  expect(initialize).toHaveBeenCalledOnce();
  expect(initialize).toHaveBeenCalledWith({ surface, stage: 'browser-runtime' });
  expect(listenerTypes).not.toContain('error');
  expect(listenerTypes).not.toContain('unhandledrejection');
  expect(posthogInit).not.toHaveBeenCalled();
  expect(posthogCapture).not.toHaveBeenCalled();
}

describe('browser monitoring entrypoints', () => {
  beforeEach(() => {
    vi.resetModules();
    createBrowserMonitoring.mockClear();
    inject.mockClear();
    initialize.mockClear();
    posthogCapture.mockClear();
    posthogInit.mockClear();
    render.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = originalFetch;
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });

  it('initializes landing monitoring tags before runtime errors without duplicate listeners', async () => {
    await expectEntrypointWiring('../src/main.js', 'landing');
  });

  it('initializes services monitoring tags before runtime errors without duplicate listeners', async () => {
    await expectEntrypointWiring('../src/services/main.jsx', 'services');
  });

  it('initializes the services analytics runtime with the slim SDK and passes the client to App', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'test-project-key');
    installBrowserGlobals();
    createBrowserMonitoring.mockReturnValueOnce({ initialize });

    await import('../src/services/main.jsx');

    expect(posthogInit).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledOnce();
    expect(render.mock.calls[0][0].props.analytics).toMatchObject({
      capture: expect.any(Function),
      initialize: expect.any(Function),
    });
  });

  it.each([
    { ok: true, result: 'success' },
    { ok: false, result: 'failed' },
  ])('captures the landing page and one contact lifecycle with a mocked $result response', async ({ ok, result }) => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'test-project-key');
    const formListeners = {};
    const submitButton = {
      classList: { add: vi.fn(), remove: vi.fn() },
      disabled: false,
      textContent: 'Send Message',
    };
    const contactForm = {
      addEventListener: vi.fn((type, listener) => {
        formListeners[type] = listener;
      }),
      email: { value: 'ada@example.test' },
      message: { value: 'Private message' },
      name: { value: 'Ada' },
      querySelector: vi.fn(() => submitButton),
      reset: vi.fn(),
    };
    globalThis.location = {
      origin: 'https://briancline.co',
      pathname: '/',
      search: '?utm_source=Newsletter&utm_campaign=summer&email=private',
      hash: '#contact',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok });
    globalThis.window = { addEventListener: vi.fn(), scrollY: 0 };
    globalThis.document = {
      referrer: 'https://Partner.Example/private/path?email=private',
      getElementById: vi.fn((id) => {
        if (id === 'main-nav') return { classList: { add: vi.fn(), remove: vi.fn() } };
        if (id === 'contact-form') return contactForm;
        return null;
      }),
      querySelectorAll: vi.fn(() => []),
    };

    await import('../src/main.js');
    expect(formListeners.input).toEqual(expect.any(Function));
    formListeners.input({ target: contactForm.name });
    formListeners.input({ target: contactForm.email });
    await formListeners.submit({ preventDefault: vi.fn() });

    expect(posthogInit).toHaveBeenCalledOnce();
    expect(posthogCapture.mock.calls).toStrictEqual([
      ['$pageview', {
        surface: 'landing',
        service: 'landing',
        utm_source: 'Newsletter',
        utm_campaign: 'summer',
        referrer: 'partner.example',
        $current_url: 'https://briancline.co/',
      }],
      ['contact_started', { surface: 'landing', service: 'landing', step: 'form' }],
      ['contact_submitted', { surface: 'landing', service: 'landing', step: 'submit', result }],
    ]);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });
});
