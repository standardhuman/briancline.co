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
    expect(promoPreviewFor('bm-3u3yp')).toBe('BM-3U3YP — $75 off your first hull cleaning');
    expect(promoPreviewFor('BM-3U3YP')).toBe('BM-3U3YP — $75 off your first hull cleaning');
  });

  it('offers WELCOME26 as a flat $75 on one-time and recurring alike', () => {
    expect(promoPreviewFor('WELCOME26')).toBe('WELCOME26 — $75 off your first cleaning');
    expect(promoPreviewFor(' welcome26 ')).toBe('WELCOME26 — $75 off your first cleaning');
    expect(promoCodeForSubmission('WELCOME26')).toBe('WELCOME26');
    expect(promoCodeForSubmission(' welcome26 ')).toBe('WELCOME26');
  });

  it('submits vouchers and bogus codes for server-side inline validation', () => {
    expect(promoCodeForSubmission(' bm-4b9gq ')).toBe('BM-4B9GQ');
    expect(promoCodeForSubmission('bogus')).toBe('BOGUS');
    expect(promoCodeForSubmission('')).toBe('');
  });

  it('uses validated server terms for amount and percent confirmations', () => {
    expect(promoConfirmation({
      code: 'BM-3U3YP', discountType: 'amount', percentApplied: null, amountAppliedCents: 7500,
    })).toBe('BM-3U3YP — $75 off your first hull cleaning');
    // WELCOME26 now reserves a flat amount, so it reads back off the validated
    // server terms like any other amount code — no percent special case.
    expect(promoConfirmation({
      code: 'WELCOME26', discountType: 'amount', percentApplied: null, amountAppliedCents: 7500,
    })).toBe('WELCOME26 — $75 off your first hull cleaning');
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
    expect(source).toContain('promoCodeForSubmission(form.promoCode)');
    // The recurring-only gate is gone: no plan-dependent promo branch survives.
    expect(source).not.toContain('promoIsWelcome26NotApplicable');
    expect(source).toContain('promoConfirmation(success.promoApplied)');
    expect(source).toContain('setPromoError(null)');
  });
});
