import { describe, expect, it } from 'vitest';
import { deriveCheckoutQuote } from '../src/services/lib/checkout-quote.js';

const AVAJOGO = {
  serviceKey: 'cleaning',
  boatLength: '25',
  boatType: 'powerboat',
  hullType: 'monohull',
  frequency: 'monthly',
  propellerCount: 1,
  anodeCount: 0,
};

describe('deriveCheckoutQuote', () => {
  it('uses the full live scale as a range when both conditions are unknown', () => {
    expect(deriveCheckoutQuote({
      ...AVAJOGO,
      paintAge: '',
      lastCleaned: '',
    })).toEqual({ mode: 'range', minCents: 15000, maxCents: 36600 });
  });

  it('keeps a partial condition capture as a range', () => {
    expect(deriveCheckoutQuote({
      ...AVAJOGO,
      paintAge: '2+yr',
      lastCleaned: '',
    })).toEqual({ mode: 'range', minCents: 15000, maxCents: 36600 });
  });

  it('uses the live exact prediction for Avajogo at four-year paint and 9-12 months', () => {
    expect(deriveCheckoutQuote({
      ...AVAJOGO,
      paintAge: '2+yr',
      lastCleaned: '9-12',
    })).toEqual({ mode: 'exact', amountCents: 36600 });
  });

  it('ignores a stale URL estimate after the customer changes known conditions', () => {
    expect(deriveCheckoutQuote({
      ...AVAJOGO,
      paintAge: '<6mo',
      lastCleaned: '<2',
      estimateAmount: 366,
    })).toEqual({ mode: 'exact', amountCents: 15000 });
  });

  it('returns no quote for invalid required pricing inputs', () => {
    expect(deriveCheckoutQuote({ ...AVAJOGO, boatLength: '' })).toBeNull();
    expect(deriveCheckoutQuote({ ...AVAJOGO, boatLength: 'nope' })).toBeNull();
    expect(deriveCheckoutQuote({ ...AVAJOGO, serviceKey: 'unknown' })).toBeNull();
  });

  it('keeps flat-rate services exact', () => {
    expect(deriveCheckoutQuote({ serviceKey: 'item_recovery' })).toEqual({
      mode: 'exact',
      amountCents: 19900,
    });
  });
});
