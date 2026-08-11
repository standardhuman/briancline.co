import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parsePromoClaimRow,
  promoErrorMessage,
  promoNotApplicableMessage,
} from '../supabase/functions/_shared/service-promo';

const functionSource = readFileSync(
  fileURLToPath(new URL('../supabase/functions/create-payment-intent/index.ts', import.meta.url)),
  'utf8',
);

describe('service promo claim response', () => {
  it('accepts the deployed percent-only RPC shape without changing WELCOME26 terms', () => {
    expect(parsePromoClaimRow({
      redemption_id: 'red-percent',
      percent_applied: 50,
      error_code: null,
    }, ' welcome26 ')).toEqual({
      ok: true,
      redemptionId: 'red-percent',
      applied: {
        code: 'WELCOME26',
        discountType: 'percent',
        percentApplied: 50,
        amountAppliedCents: null,
      },
    });
  });

  it('accepts the fixed-amount RPC shape and snapshots exactly $75', () => {
    expect(parsePromoClaimRow({
      redemption_id: 'red-amount',
      discount_type: 'amount',
      percent_applied: null,
      amount_applied_cents: 7500,
      error_code: null,
    }, 'bm-3u3yp')).toEqual({
      ok: true,
      redemptionId: 'red-amount',
      applied: {
        code: 'BM-3U3YP',
        discountType: 'amount',
        percentApplied: null,
        amountAppliedCents: 7500,
      },
    });
  });

  it('fails closed on malformed success rows', () => {
    expect(parsePromoClaimRow(null, 'BM-3U3YP')).toEqual({ ok: false, errorCode: 'rpc_failure' });
    expect(parsePromoClaimRow({ redemption_id: 'red', discount_type: 'amount' }, 'BM-3U3YP'))
      .toEqual({ ok: false, errorCode: 'rpc_failure' });
    expect(parsePromoClaimRow({ redemption_id: 'red', percent_applied: 0 }, 'WELCOME26'))
      .toEqual({ ok: false, errorCode: 'rpc_failure' });
  });

  it('preserves typed promo errors with useful customer copy', () => {
    const messages = {
      invalid_code: "That promo code isn't valid.",
      already_used: 'That promo code has already been used.',
      expired: 'That promo code has expired.',
      rate_limited: 'Too many promo attempts. Please wait and try again.',
    };
    for (const [errorCode, message] of Object.entries(messages)) {
      expect(parsePromoClaimRow({ error_code: errorCode }, 'BM-3U3YP')).toEqual({ ok: false, errorCode });
      expect(promoErrorMessage(errorCode)).toBe(message);
    }
  });
});

describe('checkout preservation boundaries', () => {
  it('keeps WELCOME26 recurring-only but permits other codes on one-time cleaning orders', () => {
    expect(promoNotApplicableMessage('WELCOME26', false)).toBe('That promo code applies to recurring cleaning plans only.');
    expect(promoNotApplicableMessage('welcome26', true)).toBeNull();
    expect(promoNotApplicableMessage('BM-3U3YP', false)).toBeNull();
  });

  it('retains v28 provider, quote, idempotency, authorization, and SetupIntent behavior', () => {
    expect(functionSource).toContain('resolveProviderOwnerUserId');
    expect(functionSource).toContain('quotesEqual(submittedQuote, canonicalQuote)');
    expect(functionSource).toContain('Idempotent reuse of recent order');
    expect(functionSource).toContain(".from('order_authorizations').insert");
    expect(functionSource).toContain('stripe.setupIntents.create');
    expect(functionSource).not.toContain('stripe.paymentIntents.create');
  });
});

