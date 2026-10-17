import { describe, expect, it } from 'vitest';
import {
  buildInvoiceAdminEmail,
  buildInvoiceCustomerEmail,
  sendInvoiceOrderNotifications,
  type EmailMessage,
  type InvoiceNotificationDeps,
  type InvoiceOrderEmailRow,
} from '../supabase/functions/_shared/invoice-order-notification.ts';
import type { OperatorSmsDeps } from '../supabase/functions/_shared/new-order-notification.ts';
import { INVOICE_TERMS_TEXT } from '../supabase/functions/_shared/invoice-terms.ts';

const order: InvoiceOrderEmailRow = {
  order_number: 'ORD-1042',
  service_type: 'Cleaning & Anodes',
  service_interval: 'bimonthly',
  estimate_mode: 'exact',
  estimated_amount: 189,
  estimated_min_amount: null,
  estimated_max_amount: null,
  notes: 'Gate code <1234>',
  service_details: null,
  dock: 'K',
  slip_number: '12',
  requires_review: true,
  boat: { name: 'Raindancer II', length: 36, make: 'Catalina', model: '36' },
  marina: { name: 'Berkeley Marina' },
  customer: { name: 'Pat Example', email: 'pat@example.com', phone: '5105550100' },
};

interface State {
  emailClaimed: boolean;
  sent: EmailMessage[];
  releases: number;
  smsSends: string[];
  warnings: string[];
}

function fakeDeps(overrides: Partial<InvoiceNotificationDeps> = {}, smsOverrides: Partial<OperatorSmsDeps> = {}) {
  const state: State = { emailClaimed: false, sent: [], releases: 0, smsSends: [], warnings: [] };
  let smsClaimed = false;
  const deps: InvoiceNotificationDeps = {
    adminEmail: 'admin@example.com',
    marinaNeedsReview: false,
    async claimEmail() {
      if (state.emailClaimed) return null;
      state.emailClaimed = true;
      return order;
    },
    async releaseEmail() {
      state.emailClaimed = false;
      state.releases += 1;
    },
    async sendEmail(message) {
      state.sent.push(message);
    },
    sms: {
      input: {
        orderId: 'order-1',
        providerId: 'provider-1',
        orderNumber: 'ORD-1042',
        boatName: 'Raindancer II',
        serviceLabel: 'Cleaning & Anodes',
        isTest: false,
        stripeLivemode: true,
      },
      deps: {
        recipient: '+14155550100',
        providerOwnerUserId: 'provider-1',
        senderConfigured: true,
        async claim() {
          if (smsClaimed) return null;
          smsClaimed = true;
          return 'token';
        },
        async release() {
          smsClaimed = false;
        },
        async send(_to, body) {
          state.smsSends.push(body);
          return 'sent';
        },
        warn() {},
        ...smsOverrides,
      },
    },
    warn(message) {
      state.warnings.push(message);
    },
    ...overrides,
  };
  return { deps, state };
}

describe('sendInvoiceOrderNotifications', () => {
  it('emails the customer and the admin and texts the operator once', async () => {
    const { deps, state } = fakeDeps();
    const first = await sendInvoiceOrderNotifications('order-1', deps);
    const second = await sendInvoiceOrderNotifications('order-1', deps);

    expect(first).toEqual({ email: 'sent', sms: { status: 'sent' } });
    expect(second).toEqual({ email: 'duplicate', sms: { status: 'skipped', reason: 'duplicate' } });
    expect(state.sent.map((m) => m.to)).toEqual(['pat@example.com', 'admin@example.com']);
    expect(state.smsSends).toHaveLength(1);
    expect(state.smsSends[0]).toContain('orders?filter=review');
  });

  it('releases the email stamp on a send failure and still texts the operator', async () => {
    const { deps, state } = fakeDeps({
      async sendEmail() {
        throw new Error('resend down');
      },
    });
    const result = await sendInvoiceOrderNotifications('order-1', deps);

    expect(result).toEqual({ email: 'send_failed', sms: { status: 'sent' } });
    expect(state.releases).toBe(1);
    expect(state.emailClaimed).toBe(false);
    expect(state.smsSends).toHaveLength(1);
    expect(state.warnings.some((w) => w.startsWith('[invoice-order-email-failed]'))).toBe(true);
  });

  it('never throws, even when every dependency does', async () => {
    const boom = async () => {
      throw new Error('boom');
    };
    const { deps } = fakeDeps(
      { claimEmail: boom, releaseEmail: boom, sendEmail: boom, warn: () => { throw new Error('warn'); } },
      { claim: boom },
    );
    await expect(sendInvoiceOrderNotifications('order-1', deps)).resolves.toEqual({
      email: 'claim_failed',
      sms: { status: 'uncertain', reason: 'claim' },
    });
  });

  it('skips the SMS when the operator SMS is not configured', async () => {
    const { deps, state } = fakeDeps({ sms: null });
    const result = await sendInvoiceOrderNotifications('order-1', deps);
    expect(result).toEqual({ email: 'sent', sms: { status: 'skipped', reason: 'not_configured' } });
    expect(state.smsSends).toHaveLength(0);
  });

  it('does not text the operator for a test-mode order', async () => {
    const { deps, state } = fakeDeps();
    deps.sms!.input = { ...deps.sms!.input, stripeLivemode: false };
    const result = await sendInvoiceOrderNotifications('order-1', deps);
    expect(result.sms).toEqual({ status: 'skipped', reason: 'test' });
    expect(state.smsSends).toHaveLength(0);
  });
});

describe('invoice order email copy', () => {
  const noEmDash = (text: string) => expect(text).not.toContain('—');
  const noEmoji = (text: string) => expect(text).not.toMatch(/\p{Extended_Pictographic}/u);

  it('tells the customer the request is pending review and no card was saved', () => {
    const email = buildInvoiceCustomerEmail(order);
    expect(email.subject).toBe('Order received: ORD-1042');
    expect(email.html).toContain("we'll review your request and confirm by email");
    expect(email.html).toContain('No card was saved.');
    expect(email.html).toContain('Pay by invoice (pending review)');
    expect(email.html).toContain('$189.00');
    for (const line of INVOICE_TERMS_TEXT) expect(email.html).toContain(line);
    expect(email.html).not.toMatch(/card is securely saved|Payment Method Saved/);
    noEmDash(email.subject + email.html);
    noEmoji(email.subject + email.html);
  });

  it('flags the admin copy as a pay-by-invoice request to approve in Pro', () => {
    const email = buildInvoiceAdminEmail(order);
    expect(email.subject).toBe('New Order: ORD-1042 - Cleaning & Anodes (PAY BY INVOICE, REVIEW)');
    expect(email.html).toContain('Pay by invoice requested, approve in Pro.');
    expect(email.html).toContain('https://pro.sailorskills.com/admin/v2/orders?filter=review');
    expect(email.html).not.toContain('Card saved');
    expect(email.html).not.toContain('The marina is also not on the standard list.');
    noEmDash(email.subject + email.html);
    noEmoji(email.subject + email.html);
  });

  it('adds the marina note only when the marina also needs review', () => {
    expect(buildInvoiceAdminEmail(order, { marinaNeedsReview: true }).html)
      .toContain('The marina is also not on the standard list.');
  });

  it('escapes customer-supplied text', () => {
    const html = buildInvoiceAdminEmail(order).html;
    expect(html).toContain('Gate code &lt;1234&gt;');
    expect(html).not.toContain('<1234>');
  });
});
