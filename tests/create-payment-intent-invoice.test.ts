/**
 * Pay-by-invoice checkout, exercised end to end through the real
 * create-payment-intent handler with fake Supabase / Stripe / fetch (see
 * tests/helpers/create-payment-intent-harness.ts). No network, DB or Stripe.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { calculateCanonicalQuote } from '../supabase/functions/_shared/checkout-quote.ts';
import {
  INVOICE_TERMS_TEXT,
  INVOICE_TERMS_VERSION,
} from '../supabase/functions/_shared/invoice-terms.ts';
import {
  filterValue,
  loadCreatePaymentIntent,
  PROVIDER_OWNER,
  type Harness,
  type HarnessOptions,
} from './helpers/create-payment-intent-harness';

function baseForm(overrides: Record<string, unknown> = {}): Record<string, any> {
  const form: Record<string, any> = {
    boatName: 'Raindancer II',
    boatLength: '36',
    boatMake: 'Catalina',
    boatModel: '36',
    boatType: 'sailboat',
    hullType: 'monohull',
    marinaName: 'Berkeley Marina',
    dock: 'K',
    slipNumber: '12',
    customerName: 'Pat Example',
    customerEmail: 'pat@example.com',
    customerPhone: '5105550100',
    billingAddress: '1 Main St',
    billingCity: 'Berkeley',
    billingState: 'CA',
    billingZip: '94710',
    serviceInterval: 'bimonthly',
    customerNotes: '',
    service: 'Cleaning & Anodes',
    promoCode: '',
    websiteUrl: '',
    turnstileToken: 'token',
    serviceDetails: {
      serviceName: 'Cleaning & Anodes',
      boatLength: '36',
      boatType: 'sailboat',
      hullType: 'monohull',
      frequency: 'bimonthly',
      propellerCount: '1',
      paintAge: '',
      lastCleaned: '',
      anodeCount: '0',
      includesAnodes: false,
    },
    authorization: {
      typedName: 'Pat Example',
      agreedToTerms: true,
      agreedToCharge: true,
      termsVersion: '2026-10-21',
      recurringTermsVersion: '2026-10-21',
      isRecurring: true,
      authorizedAt: '2026-10-17T12:00:00.000Z',
      userAgent: 'vitest',
      referer: null,
    },
    ...overrides,
  };
  form.quote = calculateCanonicalQuote(form, {});
  return form;
}

function invoiceForm(authOverrides: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}) {
  const form = baseForm({ paymentPreference: 'invoice', ...overrides });
  form.authorization = {
    ...form.authorization,
    agreedToCharge: false,
    recurringTermsVersion: null,
    agreedToInvoiceTerms: true,
    invoiceTermsVersion: INVOICE_TERMS_VERSION,
    ...authOverrides,
  };
  return form;
}

let harness: Harness | null = null;
async function load(options?: HarnessOptions) {
  harness = await loadCreatePaymentIntent(options);
  return harness;
}
afterEach(() => {
  harness?.cleanup();
  harness = null;
});

describe('create-payment-intent pay-by-invoice orders', () => {
  it('records an invoice order held for review without creating a SetupIntent', async () => {
    const h = await load();
    const res = await h.handle(invoiceForm());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ intentType: 'none', clientSecret: null, requiresReview: true });
    expect(res.body.orderNumber).toMatch(/^ORD-/);

    // No SetupIntent, but the customer, Stripe customer and boat are still created.
    expect(h.stripe.named('setupIntents.create')).toHaveLength(0);
    expect(h.stripe.named('customers.create')).toHaveLength(1);
    expect(h.db.writes('customers', 'upsert')).toHaveLength(1);
    expect(h.db.writes('boats', 'insert')).toHaveLength(1);

    // Forced review: pending_review, no recurring schedule, customer_services held.
    const [orderInsert] = h.db.writes('service_orders', 'insert');
    expect(orderInsert.payload).toMatchObject({
      status: 'pending_review',
      requires_review: true,
      provider_id: PROVIDER_OWNER,
      metadata: { payment_preference: 'invoice' },
    });
    expect(h.db.writes('service_schedules')).toHaveLength(0);
    expect(h.db.writes('customer_services', 'insert')[0].payload.status).toBe('pending_review');
  });

  it('stores the invoice terms in the authorization snapshot with null Stripe intent ids', async () => {
    const h = await load();
    await h.handle(invoiceForm());

    const [authInsert] = h.db.writes('order_authorizations', 'insert');
    expect(authInsert.payload).toMatchObject({
      typed_name: 'Pat Example',
      terms_version: '2026-10-21',
      recurring_terms_version: null,
      authorization_ip: expect.any(String),
      user_agent: 'vitest',
      is_recurring: true,
      stripe_setup_intent_id: null,
      stripe_customer_id: 'cus_test_1',
    });
    expect(authInsert.payload.quote_snapshot).toMatchObject({
      service: 'Cleaning & Anodes',
      interval: 'bimonthly',
      quote: expect.objectContaining({ mode: expect.any(String) }),
      payment_preference: 'invoice',
      invoice_terms: { version: INVOICE_TERMS_VERSION, text: [...INVOICE_TERMS_TEXT] },
    });

    // The order is linked to the authorization, with no setup intent id.
    const link = h.db.writes('service_orders', 'update')
      .find((c) => 'order_authorization_id' in c.payload);
    expect(link?.payload).toEqual({ stripe_customer_id: 'cus_test_1', order_authorization_id: 'auth-1' });
  });

  it('merges payment_preference into existing order metadata instead of replacing it', async () => {
    const h = await load();
    const form = invoiceForm({}, {
      service: 'Item Recovery',
      serviceInterval: 'one-time',
      recoveryLocation: 'Dock K',
      itemDescription: 'Sunglasses',
      dropDate: '2026-10-15',
      marinaName: 'See recovery location',
    });
    form.serviceDetails = { ...form.serviceDetails, frequency: 'one-time' };
    form.quote = calculateCanonicalQuote(form, {});
    const res = await h.handle(form);

    expect(res.status).toBe(200);
    const [orderInsert] = h.db.writes('service_orders', 'insert');
    expect(orderInsert.payload.metadata).toEqual({
      recoveryLocation: 'Dock K',
      itemDescription: 'Sunglasses',
      lostDate: '2026-10-15',
      payment_preference: 'invoice',
    });
  });

  it('sends the customer and admin emails and the operator SMS exactly once', async () => {
    const h = await load();
    await h.handle(invoiceForm());

    const emails = h.fetches.filter((f) => f.url === 'https://api.resend.com/emails');
    expect(emails).toHaveLength(2);
    expect(emails[0].body.to).toEqual(['pat@example.com']);
    expect(emails[0].body.html).toContain('No card was saved.');
    expect(emails[1].body.to).toEqual(['admin@example.com']);
    expect(emails[1].body.html).toContain('Pay by invoice requested, approve in Pro.');
    const sms = h.fetches.filter((f) => f.url.endsWith('/functions/v1/send-sms'));
    expect(sms).toHaveLength(1);
    expect(sms[0].body.to).toBe('+14155550100');

    // Idempotency stamps were claimed atomically (only while NULL).
    const emailClaim = h.db.writes('service_orders', 'update')
      .find((c) => c.payload.confirmation_email_sent_at);
    expect(filterValue(emailClaim!, 'is', 'confirmation_email_sent_at')).toBeNull();
    const smsClaim = h.db.writes('service_orders', 'update')
      .find((c) => c.payload.operator_sms_sent_at);
    expect(filterValue(smsClaim!, 'is', 'operator_sms_sent_at')).toBeNull();
  });

  it('does not re-send when the stamps are already taken', async () => {
    const h = await load();
    h.db.emailClaimed.add('order-1');
    h.db.smsClaimed.add('order-1');
    const res = await h.handle(invoiceForm());

    expect(res.status).toBe(200);
    expect(h.fetches.filter((f) => f.url.includes('resend.com'))).toHaveLength(0);
    expect(h.fetches.filter((f) => f.url.includes('send-sms'))).toHaveLength(0);
  });

  it('still succeeds when the email provider fails, releasing the email stamp', async () => {
    const h = await load({ resendStatus: 500 });
    const res = await h.handle(invoiceForm());

    expect(res.status).toBe(200);
    expect(res.body.intentType).toBe('none');
    const release = h.db.writes('service_orders', 'update')
      .find((c) => 'confirmation_email_sent_at' in c.payload && c.payload.confirmation_email_sent_at === null);
    expect(release).toBeDefined();
    // The SMS is independent of the email outcome.
    expect(h.fetches.filter((f) => f.url.includes('send-sms'))).toHaveLength(1);
  });

  it('dedupes a double-submit against recent invoice orders only, without a setup intent', async () => {
    const h = await load({
      db: (call) => {
        if (call.table === 'service_orders' && call.op === 'select') {
          return { data: { id: 'order-0', order_number: 'ORD-EARLIER', stripe_setup_intent_id: null, requires_review: true } };
        }
        return undefined;
      },
    });
    const res = await h.handle(invoiceForm());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ intentType: 'none', orderNumber: 'ORD-EARLIER', deduped: true });
    const dupLookup = h.db.calls.find((c) => c.table === 'service_orders' && c.op === 'select')!;
    expect(filterValue(dupLookup, 'eq', 'metadata->>payment_preference')).toBe('invoice');
    expect(filterValue(dupLookup, 'eq', 'customer_id')).toBe('cust-1');
    expect(filterValue(dupLookup, 'eq', 'boat_id')).toBe('boat-1');
    expect(h.db.writes('service_orders', 'insert')).toHaveLength(0);
    expect(h.db.writes('order_authorizations')).toHaveLength(0);
    expect(h.stripe.calls.filter(([n]) => n.startsWith('setupIntents.'))).toHaveLength(0);
    expect(h.fetches.filter((f) => f.url.includes('resend.com') || f.url.includes('send-sms'))).toHaveLength(0);
  });

  it('flags a marina-review invoice order in the admin email', async () => {
    const h = await load({
      db: (call) => (call.table === 'marinas' && call.columns === 'name'
        ? { data: [{ name: 'Some Other Marina' }] }
        : undefined),
    });
    const res = await h.handle(invoiceForm({}, { marinaName: 'Berkeley Yacht Harbor' }));
    expect(res.status).toBe(200);
    const admin = h.fetches.filter((f) => f.url.includes('resend.com'))[1];
    expect(admin.body.html).toContain('The marina is also not on the standard list.');
  });
});

describe('create-payment-intent invoice validation', () => {
  it.each([
    ['an unknown string', 'paypal'],
    ['the wrong case', 'Invoice'],
    ['an empty string', ''],
    ['a non-string', 1],
  ])('rejects %s as paymentPreference before any write', async (_label, value) => {
    const h = await load();
    const res = await h.handle(baseForm({ paymentPreference: value }));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payment preference.');
    expect(h.db.calls.filter((c) => c.op !== 'select')).toHaveLength(0);
    expect(h.stripe.calls).toHaveLength(0);
  });

  it('rejects an invoice terms version that does not match the server copy', async () => {
    const h = await load();
    const res = await h.handle(invoiceForm({ invoiceTermsVersion: '2026-01-01' }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Pay-by-invoice terms version not recognized/);
    expect(h.db.calls.filter((c) => c.op !== 'select')).toHaveLength(0);
    expect(h.stripe.calls).toHaveLength(0);
  });

  it('requires agreement to the pay-by-invoice terms and the Terms of Service', async () => {
    const h = await load();
    const noInvoiceTerms = await h.handle(invoiceForm({ agreedToInvoiceTerms: false }));
    expect(noInvoiceTerms.status).toBe(400);
    const noTos = await h.handle(invoiceForm({ agreedToTerms: false }));
    expect(noTos.status).toBe(400);
    expect(h.db.calls.filter((c) => c.op !== 'select')).toHaveLength(0);
  });
});

describe('create-payment-intent card orders are unchanged', () => {
  for (const preference of [undefined, 'card'] as const) {
    it(`creates the SetupIntent flow when paymentPreference is ${String(preference)}`, async () => {
      const h = await load();
      const form = baseForm(preference ? { paymentPreference: preference } : {});
      const res = await h.handle(form);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        intentType: 'setup', clientSecret: 'seti_test_1_secret_x', requiresReview: false,
      });
      expect(h.stripe.named('setupIntents.create')).toHaveLength(1);

      const [orderInsert] = h.db.writes('service_orders', 'insert');
      expect(orderInsert.payload.status).toBe('pending');
      expect(orderInsert.payload).not.toHaveProperty('metadata');
      expect(h.db.writes('service_schedules', 'insert')).toHaveLength(1);

      const [authInsert] = h.db.writes('order_authorizations', 'insert');
      expect(authInsert.payload.stripe_setup_intent_id).toBe('seti_test_1');
      expect(authInsert.payload.recurring_terms_version).toBe('2026-10-21');
      expect(authInsert.payload.quote_snapshot).not.toHaveProperty('payment_preference');
      expect(authInsert.payload.quote_snapshot).not.toHaveProperty('invoice_terms');

      // Card orders are announced by the webhook, never from here.
      expect(h.fetches.filter((f) => f.url.includes('resend.com') || f.url.includes('send-sms'))).toHaveLength(0);
      expect(h.db.writes('service_orders', 'update')
        .some((c) => 'confirmation_email_sent_at' in c.payload || 'operator_sms_sent_at' in c.payload)).toBe(false);
    });
  }

  it('still requires the charge authorization for a card order', async () => {
    const h = await load();
    const form = baseForm({ paymentPreference: 'card' });
    form.authorization = { ...form.authorization, agreedToCharge: false, agreedToInvoiceTerms: true };
    const res = await h.handle(form);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('You must accept the Terms of Service and the charge authorization to continue.');
  });

  it('reuses a recent card order setup intent exactly as before', async () => {
    const h = await load({
      db: (call) => (call.table === 'service_orders' && call.op === 'select'
        ? { data: { id: 'order-0', order_number: 'ORD-EARLIER', stripe_setup_intent_id: 'seti_old', requires_review: false } }
        : undefined),
    });
    const res = await h.handle(baseForm());
    expect(res.body).toMatchObject({ intentType: 'setup', orderNumber: 'ORD-EARLIER', deduped: true });
    const dupLookup = h.db.calls.find((c) => c.table === 'service_orders' && c.op === 'select')!;
    expect(filterValue(dupLookup, 'eq', 'metadata->>payment_preference')).toBeUndefined();
  });
});
