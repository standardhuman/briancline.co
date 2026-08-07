import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createBrowserMonitoring,
  inject,
  initialize,
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
vi.mock('../src/monitoring.js', () => ({ createBrowserMonitoring }));
vi.mock('react-dom/client', () => ({ createRoot: vi.fn(() => ({ render })) }));
vi.mock('../src/services/App', () => ({ default: () => null }));

const originalDocument = globalThis.document;
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
}

describe('browser monitoring entrypoints', () => {
  beforeEach(() => {
    vi.resetModules();
    createBrowserMonitoring.mockClear();
    inject.mockClear();
    initialize.mockClear();
    render.mockClear();
  });

  afterEach(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });

  it('initializes landing monitoring tags before runtime errors without duplicate listeners', async () => {
    await expectEntrypointWiring('../src/main.js', 'landing');
  });

  it('initializes services monitoring tags before runtime errors without duplicate listeners', async () => {
    await expectEntrypointWiring('../src/services/main.jsx', 'services');
  });
});
