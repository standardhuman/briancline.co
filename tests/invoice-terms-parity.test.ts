import { describe, expect, it } from 'vitest';
import * as client from '../src/services/pages/legal/invoice-terms.js';
import {
  INVOICE_TERMS_TEXT,
  INVOICE_TERMS_VERSION,
  invoiceSnapshotFields,
  parsePaymentPreference,
  validateInvoiceAuthorization,
  withInvoiceMetadata,
} from '../supabase/functions/_shared/invoice-terms.ts';

describe('pay-by-invoice terms parity', () => {
  it('ships the same version and text on the order form and the server', () => {
    // The server rejects any version but its own and stores ITS text as what the
    // customer agreed to, so the two copies must never drift.
    expect(client.INVOICE_TERMS_VERSION).toBe(INVOICE_TERMS_VERSION);
    expect([...client.INVOICE_TERMS_TEXT]).toEqual([...INVOICE_TERMS_TEXT]);
  });

  it('pins the 2026-10-17 wording', () => {
    expect(INVOICE_TERMS_VERSION).toBe('2026-10-17');
    expect([...INVOICE_TERMS_TEXT]).toEqual([
      'We email an invoice after each visit, along with your service report.',
      'Payment is due within 7 days by Zelle, Venmo, check, or the secure card link in the invoice. Paying through the link does not save your card.',
      'If a payment is more than 14 days late, we may hold your next scheduled service until the balance is paid.',
      'If payments run late, we may ask for a card on file to continue service.',
      'Pay-by-invoice requests are reviewed before your order is confirmed.',
    ]);
  });

  it('follows the product copy rules (no em dashes, no emoji)', () => {
    for (const line of INVOICE_TERMS_TEXT) {
      expect(line).not.toContain('—');
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('cannot be mutated at runtime', () => {
    expect(Object.isFrozen(INVOICE_TERMS_TEXT)).toBe(true);
    expect(Object.isFrozen(client.INVOICE_TERMS_TEXT)).toBe(true);
  });
});

describe('payment preference parsing', () => {
  it('defaults an absent preference to card for older clients', () => {
    expect(parsePaymentPreference(undefined)).toEqual({ ok: true, preference: 'card' });
    expect(parsePaymentPreference(null)).toEqual({ ok: true, preference: 'card' });
  });

  it('accepts exactly card or invoice', () => {
    expect(parsePaymentPreference('card')).toEqual({ ok: true, preference: 'card' });
    expect(parsePaymentPreference('invoice')).toEqual({ ok: true, preference: 'invoice' });
  });

  it.each(['', 'INVOICE', ' invoice', 'ach', 0, true, {}, ['invoice']])('rejects %j', (value) => {
    expect(parsePaymentPreference(value).ok).toBe(false);
  });
});

describe('invoice authorization', () => {
  const valid = { agreedToTerms: true, agreedToInvoiceTerms: true, invoiceTermsVersion: INVOICE_TERMS_VERSION };

  it('accepts both agreements at the server version', () => {
    expect(validateInvoiceAuthorization(valid)).toEqual({ ok: true });
  });

  it('does not need the card charge authorization', () => {
    expect(validateInvoiceAuthorization({ ...valid, agreedToCharge: false })).toEqual({ ok: true });
  });

  it('rejects a version mismatch or a missing agreement', () => {
    expect(validateInvoiceAuthorization({ ...valid, invoiceTermsVersion: '2026-10-16' }).ok).toBe(false);
    expect(validateInvoiceAuthorization({ ...valid, invoiceTermsVersion: undefined }).ok).toBe(false);
    expect(validateInvoiceAuthorization({ ...valid, agreedToInvoiceTerms: 'true' }).ok).toBe(false);
    expect(validateInvoiceAuthorization({ ...valid, agreedToTerms: false }).ok).toBe(false);
  });
});

describe('invoice order records', () => {
  it('merges payment_preference into existing metadata', () => {
    expect(withInvoiceMetadata(undefined)).toEqual({ payment_preference: 'invoice' });
    expect(withInvoiceMetadata({ recoveryLocation: 'Dock K' })).toEqual({
      recoveryLocation: 'Dock K',
      payment_preference: 'invoice',
    });
  });

  it('snapshots the version and the exact text the customer saw', () => {
    expect(invoiceSnapshotFields()).toEqual({
      payment_preference: 'invoice',
      invoice_terms: { version: INVOICE_TERMS_VERSION, text: [...INVOICE_TERMS_TEXT] },
    });
  });
});
