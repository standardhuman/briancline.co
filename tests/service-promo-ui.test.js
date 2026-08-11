import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  promoCodeForSubmission,
  promoConfirmation,
  promoPreviewFor,
} from '../src/services/lib/service-promo';

const source = readFileSync(
  fileURLToPath(new URL('../src/services/pages/DivingOrder.jsx', import.meta.url)),
  'utf8',
);

describe('voucher checkout copy', () => {
  it('shows the exact printed $75 first-hull-cleaning promise', () => {
    expect(promoPreviewFor('bm-3u3yp', false)).toBe('BM-3U3YP — $75 off your first hull cleaning');
    expect(promoPreviewFor('BM-3U3YP', true)).toBe('BM-3U3YP — $75 off your first hull cleaning');
  });

  it('preserves WELCOME26 recurring-only preview and submission behavior', () => {
    expect(promoPreviewFor('WELCOME26', true)).toBe('WELCOME26 — $75 off your first cleaning');
    expect(promoPreviewFor('WELCOME26', false)).toBe('WELCOME26 applies to recurring cleaning plans only.');
    expect(promoCodeForSubmission('WELCOME26', false)).toBe('');
    expect(promoCodeForSubmission('WELCOME26', true)).toBe('WELCOME26');
  });

  it('submits one-time vouchers and bogus codes for server-side inline validation', () => {
    expect(promoCodeForSubmission(' bm-4b9gq ', false)).toBe('BM-4B9GQ');
    expect(promoCodeForSubmission('bogus', false)).toBe('BOGUS');
    expect(promoCodeForSubmission('', false)).toBe('');
  });

  it('uses validated server terms for amount and percent confirmations', () => {
    expect(promoConfirmation({
      code: 'BM-3U3YP', discountType: 'amount', percentApplied: null, amountAppliedCents: 7500,
    })).toBe('BM-3U3YP — $75 off your first hull cleaning');
    expect(promoConfirmation({
      code: 'WELCOME26', discountType: 'percent', percentApplied: 50, amountAppliedCents: null,
    })).toBe('WELCOME26 — $75 off your first cleaning');
    expect(promoConfirmation({
      code: 'SAVE25', discountType: 'percent', percentApplied: 25, amountAppliedCents: null,
    })).toBe('SAVE25 — 25% off');
  });

  it('fails closed on malformed applied payloads', () => {
    expect(promoConfirmation(null)).toBeNull();
    expect(promoConfirmation({ code: 'BM-3U3YP', discountType: 'amount', amountAppliedCents: 0 })).toBeNull();
  });
});

describe('DivingOrder wiring', () => {
  it('retains URL prefill and uses the pure submission and confirmation contracts', () => {
    expect(source).toContain('searchParams.get("promo")');
    expect(source).toContain('promoCodeForSubmission(form.promoCode, isRecurring)');
    expect(source).toContain('promoConfirmation(success.promoApplied)');
    expect(source).toContain('setPromoError(null)');
  });
});

