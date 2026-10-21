/**
 * The order form's optional "Any scheduling needs?" field
 * (service_details.schedulingRequest) and the confirmation copy that depends on
 * it. The webhook is Deno-only, so its "What's Next?" block lives in the pure
 * helper _shared/order-scheduling.ts (tested directly) and the webhook wiring is
 * pinned with source-text assertions. Persistence runs through the real
 * create-payment-intent handler via the fake harness.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { calculateCanonicalQuote } from '../supabase/functions/_shared/checkout-quote.ts';
import {
  normalizeSchedulingRequest,
  readSchedulingRequest,
  renderSchedulingRequestAdminSection,
  renderWhatsNextBlock,
  whatsNextCopy,
  WHATS_NEXT_AFTER_SERVICE,
  WHATS_NEXT_WITH_REQUEST,
  WHATS_NEXT_WITHOUT_REQUEST,
} from '../supabase/functions/_shared/order-scheduling.ts';
import {
  buildInvoiceAdminEmail,
  type InvoiceOrderEmailRow,
} from '../supabase/functions/_shared/invoice-order-notification.ts';
import { loadCreatePaymentIntent, type Harness } from './helpers/create-payment-intent-harness';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const webhookSource = read('../supabase/functions/diving-stripe-webhook/index.ts');
const orderPageSource = read('../src/services/pages/DivingOrder.jsx');
const heading = (text: string) => `<h2>${text}</h2>`;

describe("confirmation email What's Next copy", () => {
  it('acknowledges the scheduling note when the customer left one', () => {
    expect(whatsNextCopy('Race on Nov 8, needs to be done by then')).toEqual([
      "Thanks for the scheduling note. I'll plan around it and let you know if anything doesn't work.",
      "Once each service is complete, you'll get an email with before and after videos of your hull and a service report.",
    ]);
  });

  it('sets the usual few-weeks timing when there is no scheduling note', () => {
    for (const blank of ['', '   ', null, undefined]) {
      expect(whatsNextCopy(blank)).toEqual([
        "I'll typically get you on the schedule within the next few weeks.",
        "Once each service is complete, you'll get an email with before and after videos of your hull and a service report.",
      ]);
    }
  });

  it('renders the heading and both sentences into the block', () => {
    const withRequest = renderWhatsNextBlock('Avoid weekends');
    expect(withRequest).toContain("What's Next?");
    expect(withRequest).toContain(`${WHATS_NEXT_WITH_REQUEST} ${WHATS_NEXT_AFTER_SERVICE}`);
    expect(withRequest).not.toContain(WHATS_NEXT_WITHOUT_REQUEST);

    const without = renderWhatsNextBlock('');
    expect(without).toContain(`${WHATS_NEXT_WITHOUT_REQUEST} ${WHATS_NEXT_AFTER_SERVICE}`);
    expect(without).not.toContain(WHATS_NEXT_WITH_REQUEST);
  });

  it('never promises photos, never says "be in touch", and uses no em dashes', () => {
    for (const html of [renderWhatsNextBlock('x'), renderWhatsNextBlock('')]) {
      expect(html.toLowerCase()).not.toContain('photo');
      expect(html).not.toContain('be in touch');
      expect(html).not.toContain('—');
    }
  });
});

describe('scheduling request helpers', () => {
  it('normalizes like the other free-text fields: strip angle brackets, trim, cap', () => {
    expect(normalizeSchedulingRequest('  <b>By Nov 8</b>  ')).toBe('bBy Nov 8/b');
    expect(normalizeSchedulingRequest('x'.repeat(1500))).toHaveLength(1000);
    expect(normalizeSchedulingRequest(42)).toBe('');
  });

  it('reads the request off untrusted service_details', () => {
    expect(readSchedulingRequest({ schedulingRequest: ' Haul-out Dec 1 ' })).toBe('Haul-out Dec 1');
    expect(readSchedulingRequest({})).toBe('');
    expect(readSchedulingRequest(null)).toBe('');
    expect(readSchedulingRequest('nope')).toBe('');
  });

  it('renders an escaped admin section only when there is a request', () => {
    const html = renderSchedulingRequestAdminSection('Guests Fri & Sat, "no" Mondays', heading);
    expect(html).toContain('<h2>Scheduling Needs</h2>');
    expect(html).toContain('Guests Fri &amp; Sat, &quot;no&quot; Mondays');
    expect(renderSchedulingRequestAdminSection('', heading)).toBe('');
    expect(renderSchedulingRequestAdminSection('  ', heading)).toBe('');
  });
});

describe('diving-stripe-webhook wiring', () => {
  it("builds the confirmation's What's Next block from the stored scheduling request", () => {
    expect(webhookSource).toContain("from '../_shared/order-scheduling.ts'");
    expect(webhookSource).toContain('const schedulingRequest = readSchedulingRequest(order.service_details)');
    expect(webhookSource).toContain('${renderWhatsNextBlock(schedulingRequest)}');
    expect(webhookSource).toContain('${renderSchedulingRequestAdminSection(schedulingRequest, sectionHeading)}');
    // Both generators receive the request.
    expect(webhookSource.match(/\n\s+schedulingRequest,\n\s+\)/g)).toHaveLength(2);
  });

  it('drops the old copy and the brian@ footer address', () => {
    expect(webhookSource).not.toContain("I'll be in touch to schedule your first service");
    expect(webhookSource.toLowerCase()).not.toContain('photo');
    expect(webhookSource).not.toContain('brian@briancline.co');
    expect(webhookSource).toContain('mailto:diving@briancline.co');
  });
});

describe('invoice-order admin email', () => {
  const order: InvoiceOrderEmailRow = {
    order_number: 'ORD-1042',
    service_type: 'Cleaning & Anodes',
    service_interval: 'bimonthly',
    estimate_mode: 'exact',
    estimated_amount: 189,
    estimated_min_amount: null,
    estimated_max_amount: null,
    notes: 'Gate code 1234',
    service_details: { schedulingRequest: 'Needs to be done by the Nov 8 race' },
    dock: 'K',
    slip_number: '12',
    requires_review: true,
    boat: { name: 'Raindancer II', length: 36, make: 'Catalina', model: '36' },
    marina: { name: 'Berkeley Marina' },
    customer: { name: 'Pat Example', email: 'pat@example.com', phone: '5105550100' },
  };

  it('shows Scheduling Needs as its own section, apart from Customer Notes', () => {
    const { html } = buildInvoiceAdminEmail(order);
    expect(html).toContain('Scheduling Needs');
    expect(html).toContain('Needs to be done by the Nov 8 race');
    expect(html.indexOf('Scheduling Needs')).toBeLessThan(html.indexOf('Customer Notes'));
    expect(html).not.toContain('brian@briancline.co');
  });

  it('omits the section when there is no request', () => {
    const { html } = buildInvoiceAdminEmail({ ...order, service_details: null });
    expect(html).not.toContain('Scheduling Needs');
  });
});

describe('DivingOrder scheduling field', () => {
  it('renders the optional field with its label and helper text', () => {
    expect(orderPageSource).toContain('<Field label="Any scheduling needs?">');
    expect(orderPageSource).toContain(
      'placeholder="A date it needs to be done by (race, haul-out, guests, trip), or days to avoid"',
    );
    expect(orderPageSource).toContain('onChange={(e) => updateField("schedulingRequest", e.target.value)}');
  });

  it('submits it inside serviceDetails, separate from customerNotes', () => {
    expect(orderPageSource).toContain('customerNotes: form.notes,');
    expect(orderPageSource).toMatch(
      /serviceDetails: \{[\s\S]*?schedulingRequest: form\.schedulingRequest\.trim\(\),[\s\S]*?\},/,
    );
  });

  it('describes surcharge documentation as the service report and videos', () => {
    expect(orderPageSource).toContain('documented in your service report and videos.');
    expect(orderPageSource).not.toContain('documented with photos');
  });
});

describe('create-payment-intent persists the scheduling request', () => {
  let harness: Harness | null = null;
  afterEach(() => {
    harness?.cleanup();
    harness = null;
  });

  function form(schedulingRequest: unknown): Record<string, any> {
    const f: Record<string, any> = {
      boatName: 'Raindancer II', boatLength: '36', boatMake: 'Catalina', boatModel: '36',
      boatType: 'sailboat', hullType: 'monohull', marinaName: 'Berkeley Marina', dock: 'K', slipNumber: '12',
      customerName: 'Pat Example', customerEmail: 'pat@example.com', customerPhone: '5105550100',
      billingAddress: '1 Main St', billingCity: 'Berkeley', billingState: 'CA', billingZip: '94710',
      serviceInterval: 'bimonthly', customerNotes: 'Gate code 1234', service: 'Cleaning & Anodes',
      promoCode: '', websiteUrl: '', turnstileToken: 'token',
      serviceDetails: {
        serviceName: 'Cleaning & Anodes', boatLength: '36', boatType: 'sailboat', hullType: 'monohull',
        frequency: 'bimonthly', propellerCount: '1', paintAge: '', lastCleaned: '', anodeCount: '0',
        includesAnodes: false, schedulingRequest,
      },
      authorization: {
        typedName: 'Pat Example', agreedToTerms: true, agreedToCharge: true,
        termsVersion: '2026-10-21', recurringTermsVersion: '2026-10-21', isRecurring: true,
        authorizedAt: '2026-10-17T12:00:00.000Z', userAgent: 'vitest', referer: null,
      },
    };
    f.quote = calculateCanonicalQuote(f, {});
    return f;
  }

  it('stores it on service_details, sanitized, with notes untouched', async () => {
    harness = await loadCreatePaymentIntent();
    const res = await harness.handle(form('  Race Nov 8 <b>please</b>  '));
    expect(res.status).toBe(200);
    const [orderInsert] = harness.db.writes('service_orders', 'insert');
    expect(orderInsert.payload.service_details.schedulingRequest).toBe('Race Nov 8 bplease/b');
    expect(orderInsert.payload.notes).toBe('Gate code 1234');
  });

  it('drops the key when the customer left it blank', async () => {
    harness = await loadCreatePaymentIntent();
    const res = await harness.handle(form('   '));
    expect(res.status).toBe(200);
    const [orderInsert] = harness.db.writes('service_orders', 'insert');
    expect(orderInsert.payload.service_details).not.toHaveProperty('schedulingRequest');
  });
});
