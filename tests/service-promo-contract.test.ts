import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parsePromoClaimRow,
  promoErrorMessage,
  releaseReservedPromoClaim,
} from '../supabase/functions/_shared/service-promo';

const functionSource = readFileSync(
  fileURLToPath(new URL('../supabase/functions/create-payment-intent/index.ts', import.meta.url)),
  'utf8',
);

describe('service promo claim response', () => {
  it('accepts the legacy percent-only RPC shape for codes still configured that way', () => {
    expect(parsePromoClaimRow({
      redemption_id: 'red-percent',
      percent_applied: 50,
      error_code: null,
    }, ' save50 ')).toEqual({
      ok: true,
      redemptionId: 'red-percent',
      applied: {
        code: 'SAVE50',
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
  it('gates no promo code to a plan type client-side and leaves applicability to the RPC', () => {
    expect(functionSource).not.toContain('promoNotApplicableMessage');
    expect(functionSource).not.toContain('recurring cleaning plans only');
    expect(functionSource).not.toContain('promo_not_applicable');
    // The RPC still receives the plan shape, so DB config owns any restriction.
    expect(functionSource).toContain('p_is_recurring: isRecurringPromoOrder');
  });

  it('retains v28 provider, quote, idempotency, authorization, and SetupIntent behavior', () => {
    expect(functionSource).toContain('resolveProviderOwnerUserId');
    expect(functionSource).toContain('quotesEqual(submittedQuote, canonicalQuote)');
    expect(functionSource).toContain('Idempotent reuse of recent order');
    expect(functionSource).toContain(".from('order_authorizations').insert");
    expect(functionSource).toContain('stripe.setupIntents.create');
    expect(functionSource).not.toContain('stripe.paymentIntents.create');
  });

  it('best-effort releases a reservation after a post-claim checkout failure', async () => {
    const calls: unknown[][] = [];
    const supabase = {
      from(table: string) {
        calls.push(['from', table]);
        return {
          update(values: unknown) {
            calls.push(['update', values]);
            return {
              eq(column: string, value: unknown) {
                calls.push(['eq', column, value]);
                return {
                  async eq(secondColumn: string, secondValue: unknown) {
                    calls.push(['eq', secondColumn, secondValue]);
                    return { error: null };
                  },
                };
              },
            };
          },
        };
      },
    };

    await expect(releaseReservedPromoClaim(supabase, 'red-amount')).resolves.toBe(true);
    expect(calls).toEqual([
      ['from', 'service_promo_redemptions'],
      ['update', { status: 'released' }],
      ['eq', 'id', 'red-amount'],
      ['eq', 'status', 'reserved'],
    ]);
    expect(functionSource).toContain('await releaseReservedPromoClaim(supabase, promoRedemptionId)');
  });
});
