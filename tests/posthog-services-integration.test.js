import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  useEffect,
  useElements,
  useLocation,
  useNavigate,
  useSearchParams,
  useState,
  useStripe,
} = vi.hoisted(() => ({
  useEffect: vi.fn((effect) => effect()),
  useElements: vi.fn(),
  useLocation: vi.fn(),
  useNavigate: vi.fn(() => vi.fn()),
  useSearchParams: vi.fn(),
  useState: vi.fn(),
  useStripe: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal()),
  useCallback: (callback) => callback,
  useEffect,
  useRef: (initial) => ({ current: initial }),
  useState,
}));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useLocation,
  useNavigate,
  useSearchParams,
}));
vi.mock('@stripe/react-stripe-js', async (importOriginal) => ({
  ...(await importOriginal()),
  useElements,
  useStripe,
}));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn() }));

import App from '../src/services/App.jsx';
import Deliveries from '../src/services/pages/Deliveries.jsx';
import Detailing from '../src/services/pages/Detailing.jsx';
import DivingOrder from '../src/services/pages/DivingOrder.jsx';

beforeEach(() => {
  vi.clearAllMocks();
  useState.mockReset();
  useEffect.mockImplementation((effect) => effect());
  globalThis.document = { referrer: '' };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: 'mock-browser' },
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

function analyticsDouble() {
  return { capture: vi.fn(), initialize: vi.fn() };
}

function formElement(componentTree) {
  return findElement(componentTree, (element) => element.type === 'form');
}

function componentElement(componentTree, name) {
  return findElement(componentTree, (element) => (
    typeof element.type === 'function' && element.type.name === name
  ));
}

const validDeliveryForm = {
  name: 'Ada', email: 'ada@example.test', phone: '',
  vesselMake: '', vesselModel: '', vesselLength: '', vesselYear: '', vesselCondition: '',
  currentMarina: '', currentCity: '', destMarina: '', destCity: '',
  schedule: '', deadline: '', notes: '',
};

const validDetailingForm = {
  name: 'Ada', email: 'ada@example.test', phone: '', marina: '', dockSlip: '', boatName: '',
  boatLength: '', services: [], notes: '', anythingElse: '',
};

const validOrderForm = {
  boatName: 'Private boat', boatType: 'monohull_sailboat', boatMake: '', boatModel: '',
  boatLength: '35', marina: 'Berkeley Marina', dock: '', slip: '',
  customerName: 'Ada Lovelace', customerEmail: 'ada@example.test', customerPhone: '',
  billingAddress: 'Private', billingCity: 'Berkeley', billingState: 'CA', billingZip: '94710',
  frequency: 'quarterly', paintAge: '', lastCleaned: '', notes: '', promoCode: '',
  recoveryLocation: '', itemDescription: '', dateLost: '', anodeInfo: '', propellerCount: '1',
  websiteUrl: '',
};

function arrangeState(...states) {
  for (const [value, setter = vi.fn()] of states) {
    useState.mockImplementationOnce(() => [value, setter]);
  }
}

function searchParams(values = {}) {
  return { get: (key) => values[key] ?? null };
}

describe('services route analytics', () => {
  it('captures a sanitized pageview and service event on every router location change', () => {
    const analytics = analyticsDouble();
    useLocation.mockReturnValueOnce({ pathname: '/marine', search: '?utm_source=Newsletter&email=private' });

    const tracker = componentElement(App({ analytics }), 'ServicesAnalyticsTracker');
    if (!tracker) expect.fail('ServicesAnalyticsTracker is not wired into App');
    tracker.type(tracker.props);

    useLocation.mockReturnValueOnce({ pathname: '/boat-detailing', search: '?utm_campaign=spring', hash: '#private' });
    tracker.type(tracker.props);

    expect(analytics.capture.mock.calls).toStrictEqual([
      ['$pageview', { surface: 'services', service: 'marine', utm_source: 'Newsletter' }],
      ['service_viewed', { surface: 'services', service: 'marine' }],
      ['$pageview', { surface: 'services', service: 'boat-detailing', utm_campaign: 'spring' }],
      ['service_viewed', { surface: 'services', service: 'boat-detailing' }],
    ]);
  });
});

describe.each([
  {
    name: 'delivery',
    component: Deliveries,
    inner: 'DeliveryInquiryForm',
    service: 'deliveries',
    validForm: validDeliveryForm,
    arrange(form, setters) {
      arrangeState([form], [false, setters.submitting], [false, setters.submitted], ['', setters.error]);
    },
  },
  {
    name: 'detailing',
    component: Detailing,
    inner: 'EstimateForm',
    service: 'boat-detailing',
    validForm: validDetailingForm,
    arrange(form, setters) {
      arrangeState([form], [false, setters.submitting], [false, setters.submitted], ['', setters.error]);
    },
  },
])('$name contact analytics', ({ component, inner, service, validForm, arrange }) => {
  it.each([
    { ok: true, result: 'success' },
    { ok: false, result: 'failed' },
  ])('captures one start and the visible $result result without a real request', async ({ ok, result }) => {
    const analytics = analyticsDouble();
    const setters = { submitting: vi.fn(), submitted: vi.fn(), error: vi.fn() };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok });

    useState.mockImplementationOnce((initial) => [initial, vi.fn()]);
    const page = component({ analytics });
    const innerForm = componentElement(page, inner);
    expect(innerForm).toEqual(expect.any(Object));
    useState.mockReset();
    arrange(validForm, setters);
    const form = formElement(innerForm.type(innerForm.props));
    expect(form).toEqual(expect.any(Object));

    expect(form.props.onChangeCapture).toEqual(expect.any(Function));
    form.props.onChangeCapture({});
    form.props.onChangeCapture({});
    await form.props.onSubmit({ preventDefault: vi.fn() });

    expect(analytics.capture.mock.calls).toStrictEqual([
      ['contact_started', { surface: 'services', service, step: 'form' }],
      ['contact_submitted', { surface: 'services', service, step: 'submit', result }],
    ]);
    const visibleSetter = ok ? setters.submitted : setters.error;
    expect(visibleSetter.mock.invocationCallOrder.at(-1))
      .toBeLessThan(analytics.capture.mock.invocationCallOrder.at(-1));
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });
});

function renderOrderForm({
  analytics,
  valid = true,
  stripeResult = {},
  errorSetter = vi.fn(),
  service = 'cleaning',
}) {
  const stripe = {
    confirmCardPayment: vi.fn().mockResolvedValue(stripeResult),
    confirmCardSetup: vi.fn().mockResolvedValue(stripeResult),
  };
  useStripe.mockReturnValue(stripe);
  useElements.mockReturnValue({ getElement: vi.fn(() => ({ id: 'mock-card' })) });
  useSearchParams.mockReturnValue([searchParams({ service })]);
  useEffect.mockImplementation(() => {});
  arrangeState([{ id: 'mock-stripe-runtime' }]);
  const page = DivingOrder({ analytics });
  const inner = componentElement(page, 'OrderForm');
  expect(inner).toEqual(expect.any(Object));

  useState.mockReset();
  arrangeState(
    [{ ...validOrderForm, ...(valid ? {} : { customerEmail: '' }) }],
    [true],
    [true],
    ['Ada Lovelace'],
    [false],
    [null, errorSetter],
    [null],
    [null],
    [{ numberComplete: true, expiryComplete: true, cvcComplete: true }],
    [{ number: null, expiry: null, cvc: null }],
    [''],
  );
  return { form: formElement(inner.type(inner.props)), stripe };
}

describe('checkout analytics boundaries', () => {
  it('does not start checkout before the existing submit, Stripe, and Elements guards pass', async () => {
    const analytics = analyticsDouble();
    globalThis.fetch = vi.fn();
    const { form } = renderOrderForm({ analytics, valid: false });

    await form.props.onSubmit({ preventDefault: vi.fn() });

    expect(analytics.capture).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('captures start after guards and the accepted handoff immediately before Stripe confirmation', async () => {
    const analytics = analyticsDouble();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        clientSecret: 'mock-client-secret',
        intentType: 'payment',
        orderNumber: 'mock-order',
        promoApplied: null,
      }),
    });
    const { form, stripe } = renderOrderForm({ analytics });

    await form.props.onSubmit({ preventDefault: vi.fn() });

    expect(analytics.capture.mock.calls).toStrictEqual([
      ['checkout_started', { surface: 'services', service: 'hull-cleaning', step: 'payment-intent', result: 'started' }],
      ['checkout_redirected', { surface: 'services', service: 'hull-cleaning', step: 'stripe-confirmation', result: 'started' }],
    ]);
    expect(analytics.capture.mock.invocationCallOrder[1])
      .toBeLessThan(stripe.confirmCardPayment.mock.invocationCallOrder[0]);
  });

  it('records recurring cleaning checkout as the hull-cleaning service', async () => {
    const analytics = analyticsDouble();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('mock payment-intent failure'));
    const { form } = renderOrderForm({ analytics, service: 'recurring_cleaning' });

    await form.props.onSubmit({ preventDefault: vi.fn() });

    expect(analytics.capture).toHaveBeenCalledWith('checkout_started', {
      surface: 'services', service: 'hull-cleaning', step: 'payment-intent', result: 'started',
    });
    expect(analytics.capture).toHaveBeenLastCalledWith('checkout_failed', {
      surface: 'services', service: 'hull-cleaning', step: 'payment-intent', result: 'failed',
    });
  });

  it.each([
    { phase: 'payment intent', stripeError: null, expectedStep: 'payment-intent' },
    { phase: 'Stripe confirmation', stripeError: new Error('mock failure'), expectedStep: 'stripe-confirmation' },
  ])('captures a safe failed result after the visible $phase catch path', async ({ stripeError, expectedStep }) => {
    const analytics = analyticsDouble();
    const visibleError = vi.fn();
    if (stripeError) {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          clientSecret: 'mock-client-secret', intentType: 'payment', orderNumber: 'mock-order', promoApplied: null,
        }),
      });
    } else {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('mock failure'));
    }
    const { form } = renderOrderForm({
      analytics,
      stripeResult: stripeError ? { error: stripeError } : {},
      errorSetter: visibleError,
    });

    await form.props.onSubmit({ preventDefault: vi.fn() });

    expect(analytics.capture).toHaveBeenLastCalledWith('checkout_failed', {
      surface: 'services', service: 'hull-cleaning', step: expectedStep, result: 'failed',
    });
    expect(analytics.capture.mock.calls.at(-1)[1]).not.toHaveProperty('error');
    expect(visibleError.mock.invocationCallOrder.at(-1))
      .toBeLessThan(analytics.capture.mock.invocationCallOrder.at(-1));
  });
});
