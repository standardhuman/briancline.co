/**
 * Pay-by-invoice on the order page. The payment components are rendered with
 * react-dom/server (no DOM needed); DivingOrder itself needs Stripe Elements and
 * the router, so its wiring is pinned with source-text assertions, the same
 * convention range-checkout-render.test.js uses.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ByPaymentPreference,
  InvoiceTermsAgreement,
  PaymentPreferenceChoice,
} from '../src/services/components/PayByInvoice.jsx';
import { INVOICE_TERMS_TEXT } from '../src/services/pages/legal/invoice-terms.js';

const source = readFileSync(
  fileURLToPath(new URL('../src/services/pages/DivingOrder.jsx', import.meta.url)),
  'utf8',
);

const h = React.createElement;
const noop = () => {};

// Mirrors the payment section's shape: the choice, then the card slot (Stripe
// fields + charge authorization) or the invoice slot (terms + checkbox).
function renderPayment(paymentPreference) {
  return renderToStaticMarkup(h('div', null,
    h(PaymentPreferenceChoice, { value: paymentPreference, onChange: noop }),
    h(ByPaymentPreference, {
      paymentPreference,
      card: h('div', { 'data-testid': 'card-fields' }, 'Card Number'),
      invoice: h(InvoiceTermsAgreement, { checked: false, onChange: noop }),
    }),
  ));
}

describe('payment preference toggle', () => {
  it('offers both options with card on file selected by default', () => {
    const html = renderPayment('card');
    expect(html).toContain('How would you like to pay?');
    expect(html).toContain('Card on file (charged after each service)');
    expect(html).toContain('Pay by invoice (requires approval)');
    expect(html).toMatch(/aria-checked="true"[^>]*data-payment-preference="card"/);
    expect(html).toMatch(/aria-checked="false"[^>]*data-payment-preference="invoice"/);
  });

  it('shows the card fields and no invoice terms for card on file', () => {
    const html = renderPayment('card');
    expect(html).toContain('data-testid="card-fields"');
    expect(html).not.toContain('I agree to the pay-by-invoice terms');
  });

  it('hides the card fields and shows the invoice terms with a required checkbox', () => {
    const html = renderPayment('invoice');
    expect(html).not.toContain('data-testid="card-fields"');
    expect(html).not.toContain('Card Number');
    expect(html).toMatch(/aria-checked="true"[^>]*data-payment-preference="invoice"/);
    for (const line of INVOICE_TERMS_TEXT) expect(html).toContain(line);
    expect(html).toContain('id="agree-invoice-terms"');
    expect(html).toContain('I agree to the pay-by-invoice terms');
  });
});

describe('DivingOrder pay-by-invoice wiring', () => {
  const cardSlots = source.split('card={(').slice(1);

  it('mounts the Stripe card fields only in the card slot', () => {
    expect(cardSlots).toHaveLength(2);
    expect(cardSlots[0]).toMatch(/<CardNumberElement[\s\S]*<CardExpiryElement[\s\S]*<CardCvcElement/);
    const outsideSlots = source.replace(/card=\{\([\s\S]*?\n\s*\)\}\n\s*\/>/g, '');
    expect(outsideSlots).not.toContain('<CardNumberElement');
    expect(outsideSlots).not.toContain('id="agree-charge"');
  });

  it('puts the charge authorization in the card slot and the invoice terms in the invoice slot', () => {
    expect(cardSlots[1]).toContain('id="agree-charge"');
    expect(source).toMatch(/invoice=\{\(\s*<InvoiceTermsAgreement checked=\{agreedToInvoiceTerms\}/);
  });

  it('requires the invoice terms instead of the card and charge authorization when invoicing', () => {
    expect(source).toMatch(/const paymentReady = isInvoice\s*\?\s*agreedToInvoiceTerms\s*:\s*agreedToCharge && allCardComplete;/);
    expect(source).toMatch(/agreedToTerms &&\s*paymentReady &&\s*typedNameMatches &&/);
    expect(source).toContain('if (isInvoice && !agreedToInvoiceTerms) missing.push("Pay-by-invoice terms checkbox");');
    expect(source).toContain('if (!isInvoice && !agreedToCharge) missing.push("Charge authorization checkbox");');
    expect(source).toContain('if (!isInvoice && !cardState.numberComplete) missing.push("Card number");');
  });

  it('keeps the typed name and Terms of Service for both payment choices', () => {
    expect(source).toContain('id="agree-terms"');
    expect(source).toContain('id="typed-name"');
    expect(source).toContain('{isRecurring && !isInvoice && (');
  });

  it('submits the preference and the invoice terms version', () => {
    expect(source).toContain('paymentPreference,');
    expect(source).toContain('{ agreedToInvoiceTerms, invoiceTermsVersion: INVOICE_TERMS_VERSION }');
    expect(source).toContain('agreedToCharge: isInvoice ? false : agreedToCharge,');
  });

  it('skips card confirmation and shows the invoice success screen', () => {
    const invoiceBranch = source.slice(
      source.indexOf('if (isInvoice) {\n        if (intentType !== "none")'),
      source.indexOf('const billingDetails = {'),
    );
    expect(invoiceBranch).toContain('return;');
    expect(invoiceBranch).not.toContain('confirmCardSetup');
    expect(source).toContain("We'll review your pay-by-invoice request and confirm by email. No card was saved.");
    expect(source).toContain('Order received.');
  });

  it('preselects Pay by invoice only for ?payment=invoice', () => {
    expect(source).toMatch(/searchParams\.get\("payment"\) === PAYMENT_PREFERENCE_INVOICE \? PAYMENT_PREFERENCE_INVOICE : PAYMENT_PREFERENCE_CARD/);
  });

  it('says invoiced, not charged, in the summary when invoicing', () => {
    expect(source).toContain('{isInvoice ? "Invoiced after each visit" : "Charged after service completion"}');
    expect(source).toMatch(/isInvoice=\{isInvoice\}/);
  });

  it('resets card completeness when the preference changes', () => {
    const chooser = source.slice(source.indexOf('const choosePaymentPreference'), source.indexOf('}, []);', source.indexOf('const choosePaymentPreference')));
    expect(chooser).toContain('setCardState({ numberComplete: false, expiryComplete: false, cvcComplete: false });');
  });
});
