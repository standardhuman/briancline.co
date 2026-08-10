import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(here, '../src/services/pages/DivingOrder.jsx'),
  'utf8',
);

describe('range-aware order page contract', () => {
  it('derives and requires a live checkout quote', () => {
    expect(source).toContain('deriveCheckoutQuote');
    expect(source).toMatch(/const checkoutQuote\s*=\s*deriveCheckoutQuote\(conditionInputs\)/);
    expect(source).toMatch(/frequencyChosen\s*&&\s*checkoutQuote\s*&&/);
  });

  it('submits the discriminated quote without a zero-price fallback', () => {
    expect(source).toContain('quote: checkoutQuote');
    expect(source).not.toContain('estimate: estimateAmount || 0');
  });

  it('renders the live range in the estimate and authorization copy', () => {
    expect(source).toContain('Estimated first-cleaning range:');
    expect(source).toContain("checkoutQuote.mode === 'range'");
    expect(source).toMatch(/Billing:[\s\S]*checkoutQuote/);
  });

  it('uses the stable refresh message for a server pricing mismatch', () => {
    expect(source).toContain('pricing_changed');
    expect(source).toContain('Pricing changed while this page was open. Please refresh and review the updated estimate.');
  });
});
