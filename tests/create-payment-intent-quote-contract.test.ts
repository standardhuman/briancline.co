import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(here, '../supabase/functions/create-payment-intent/index.ts'),
  'utf8',
);

describe('create-payment-intent quote contract', () => {
  it('validates an exact canonical quote before the first customer or Stripe write', () => {
    expect(source).toContain("from '../_shared/checkout-quote.ts'");
    const validationAt = source.indexOf('calculateCanonicalQuote(');
    const customerWriteAt = source.indexOf(".from('customers').upsert");
    const stripeWriteAt = source.indexOf('stripe.customers.create(');
    expect(validationAt).toBeGreaterThan(-1);
    expect(validationAt).toBeLessThan(customerWriteAt);
    expect(validationAt).toBeLessThan(stripeWriteAt);
    expect(source).toContain("code: 'pricing_changed'");
    expect(source).not.toContain("throw new Error('Invalid price calculation')");
  });

  it('uses the complete quote representation for idempotency', () => {
    expect(source).toContain(".eq('estimate_mode', checkoutQuote.mode)");
    expect(source).toContain(".eq('estimated_min_amount', checkoutQuote.minCents / 100)");
    expect(source).toContain(".eq('estimated_max_amount', checkoutQuote.maxCents / 100)");
  });

  it('projects exact or range columns without substituting the range maximum', () => {
    expect(source).toContain("estimate_mode: 'range'");
    expect(source).toContain('estimated_amount: null');
    expect(source).toContain('estimated_min_amount: checkoutQuote.minCents / 100');
    expect(source).toContain('estimated_max_amount: checkoutQuote.maxCents / 100');
    expect(source).toContain('base_price: exactAmount');
  });

  it('stores quote-aware authorization and Stripe metadata', () => {
    expect(source).toContain('quote_mode: checkoutQuote.mode');
    expect(source).toContain('quoted_min_cents:');
    expect(source).toContain('quoted_max_cents:');
    expect(source).toContain('quote: checkoutQuote');
    expect(source).toContain("quote_mode: checkoutQuote.mode");
    expect(source).toContain('estimated_min: (checkoutQuote.minCents / 100).toString()');
    expect(source).toContain('estimated_max: (checkoutQuote.maxCents / 100).toString()');
  });

  it('annualizes only exact recurring quotes', () => {
    expect(source).toMatch(/if \(!isRecurringOrder \|\| checkoutQuote\.mode !== 'exact'\) return null/);
  });
});
