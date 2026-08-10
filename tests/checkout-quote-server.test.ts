import { describe, expect, it } from 'vitest';
import {
  calculateCanonicalQuote,
  parseSubmittedQuote,
  quotesEqual,
} from '../supabase/functions/_shared/checkout-quote.ts';

const PRICING = {
  minimum_service_charge: 150,
  recurring_cleaning_rate: 4.5,
  onetime_cleaning_rate: 6,
  underwater_inspection_rate: 3.99,
  item_recovery_rate: 199,
  propeller_service_rate: 349,
  anodes_only_rate: 149,
  anode_installation_rate: 15,
};

const AVAJOGO = {
  service: 'Cleaning & Anodes',
  serviceInterval: 'bimonthly',
  boatLength: '25',
  serviceDetails: {
    boatLength: '25',
    boatType: 'powerboat',
    hullType: 'monohull',
    frequency: 'bimonthly',
    propellerCount: '1',
    paintAge: '',
    lastCleaned: '',
    anodeCount: '0',
  },
};

describe('calculateCanonicalQuote', () => {
  it('recomputes Avajogo unknown conditions as the literal $150-$366 range', () => {
    expect(calculateCanonicalQuote(AVAJOGO, PRICING)).toEqual({
      mode: 'range',
      minCents: 15000,
      maxCents: 36600,
    });
  });

  it('recomputes Avajogo four-year paint and 9-12 months as an exact $366', () => {
    expect(calculateCanonicalQuote({
      ...AVAJOGO,
      serviceDetails: {
        ...AVAJOGO.serviceDetails,
        paintAge: '2+yr',
        lastCleaned: '9-12',
      },
    }, PRICING)).toEqual({ mode: 'exact', amountCents: 36600 });
  });

  it('rejects invalid pricing inputs instead of falling back to a severe quote', () => {
    expect(calculateCanonicalQuote({ ...AVAJOGO, boatLength: '0' }, PRICING)).toBeNull();
    expect(calculateCanonicalQuote({ ...AVAJOGO, serviceInterval: '' }, PRICING)).toBeNull();
    expect(calculateCanonicalQuote({
      ...AVAJOGO,
      serviceDetails: { ...AVAJOGO.serviceDetails, paintAge: 'ancient' },
    }, PRICING)).toBeNull();
  });

  it('keeps flat-rate services exact', () => {
    expect(calculateCanonicalQuote({
      service: 'Item Recovery',
      serviceInterval: 'one-time',
      boatLength: '0',
      serviceDetails: {},
    }, PRICING)).toEqual({ mode: 'exact', amountCents: 19900 });

    expect(calculateCanonicalQuote({
      service: 'Propeller Service',
      serviceInterval: 'one-time',
      boatLength: '25',
      serviceDetails: { propellerCount: '2' },
    }, PRICING)).toEqual({ mode: 'exact', amountCents: 69800 });
  });
});

describe('submitted quote validation', () => {
  it('accepts only positive integer exact and ordered range shapes', () => {
    expect(parseSubmittedQuote({ mode: 'exact', amountCents: 36600 })).toEqual({ mode: 'exact', amountCents: 36600 });
    expect(parseSubmittedQuote({ mode: 'range', minCents: 15000, maxCents: 36600 })).toEqual({ mode: 'range', minCents: 15000, maxCents: 36600 });

    for (const malformed of [
      null,
      { mode: 'exact', amountCents: 0 },
      { mode: 'exact', amountCents: 10.5 },
      { mode: 'range', minCents: 0, maxCents: 100 },
      { mode: 'range', minCents: 200, maxCents: 100 },
      { mode: 'range', minCents: 100, maxCents: 100 },
      { mode: 'range', minCents: 100, maxCents: 200, amountCents: 150 },
    ]) {
      expect(parseSubmittedQuote(malformed)).toBeNull();
    }
  });

  it('requires an exact match rather than accepting a value inside an envelope', () => {
    const canonical = calculateCanonicalQuote(AVAJOGO, PRICING);
    expect(quotesEqual(canonical, { mode: 'range', minCents: 15000, maxCents: 36600 })).toBe(true);
    expect(quotesEqual(canonical, { mode: 'range', minCents: 15000, maxCents: 36500 })).toBe(false);
    expect(quotesEqual(canonical, { mode: 'exact', amountCents: 36600 })).toBe(false);
  });
});
