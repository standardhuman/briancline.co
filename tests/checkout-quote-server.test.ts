import { describe, expect, it } from 'vitest';
import {
  calculateCanonicalQuote,
  parseSubmittedQuote,
  quotesEqual,
} from '../supabase/functions/_shared/checkout-quote.ts';
import { deriveCheckoutQuote } from '../src/services/lib/checkout-quote.js';

const PRICING = {
  minimum_service_charge: 150,
  recurring_cleaning_rate: 4.5,
  onetime_cleaning_rate: 6,
  // Production's legacy table has drifted from the shipped standalone-service
  // calculator. Strict quote validation must preserve what the customer sees.
  underwater_inspection_rate: 4,
  item_recovery_rate: 200,
  propeller_service_rate: 350,
  anodes_only_rate: 150,
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

  it('preserves the shipped $3.99 inspection rate despite stale legacy config', () => {
    expect(calculateCanonicalQuote({
      service: 'Underwater Inspection',
      serviceInterval: 'one-time',
      boatLength: '50',
      serviceDetails: {
        boatLength: '50',
        boatType: 'powerboat',
        hullType: 'monohull',
      },
    }, PRICING)).toEqual({ mode: 'exact', amountCents: 24900 });
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

describe('browser/server cleaning parity', () => {
  it('matches every representative hull, cadence, condition, propeller, and anode combination', () => {
    const paintAges = ['', '<6mo', '6-12mo', '1-1.5yr', '1.5-2yr', '2+yr'];
    const cleaningAges = ['', '<2', '2-4', '5-6', '7-8', '9-12', '13-24', '24+'];

    for (const boatLength of [10, 25, 42, 80]) {
      for (const boatType of ['sailboat', 'powerboat']) {
        for (const hullType of ['monohull', 'catamaran', 'trimaran']) {
          for (const frequency of ['monthly', 'onetime']) {
            for (const propellerCount of [1, 2]) {
              for (const anodeCount of [0, 2]) {
                for (const paintAge of paintAges) {
                  for (const lastCleaned of cleaningAges) {
                    const browserInputs = {
                      serviceKey: 'cleaning', boatLength, boatType, hullType,
                      frequency, propellerCount, anodeCount, paintAge, lastCleaned,
                    };
                    const browserQuote = deriveCheckoutQuote(browserInputs);
                    const serverQuote = calculateCanonicalQuote({
                      service: 'Cleaning & Anodes',
                      serviceInterval: frequency === 'onetime' ? 'one-time' : frequency,
                      boatLength: String(boatLength),
                      serviceDetails: {
                        boatLength: String(boatLength), boatType, hullType,
                        frequency: frequency === 'onetime' ? 'one-time' : frequency,
                        propellerCount: String(propellerCount),
                        anodeCount: String(anodeCount), paintAge, lastCleaned,
                      },
                    }, PRICING);
                    expect(serverQuote, JSON.stringify(browserInputs)).toEqual(browserQuote);
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  it('matches the shipped standalone-service calculator despite stale config rows', () => {
    const cases = [
      {
        browser: { serviceKey: 'item_recovery' },
        server: { service: 'Item Recovery', serviceInterval: 'one-time', boatLength: '0', serviceDetails: {} },
      },
      {
        browser: { serviceKey: 'propeller_service', propellerCount: 2 },
        server: { service: 'Propeller Service', serviceInterval: 'one-time', boatLength: '0', propellerCount: '2', serviceDetails: { propellerCount: '2' } },
      },
      {
        browser: { serviceKey: 'anodes_only', anodeCount: 4 },
        server: { service: 'Anodes Only', serviceInterval: 'one-time', boatLength: '0', serviceDetails: { anodeCount: '4' } },
      },
      {
        browser: { serviceKey: 'underwater_inspection', boatLength: 50, boatType: 'powerboat', hullType: 'monohull' },
        server: { service: 'Underwater Inspection', serviceInterval: 'one-time', boatLength: '50', serviceDetails: { boatLength: '50', boatType: 'powerboat', hullType: 'monohull' } },
      },
    ];

    for (const { browser, server } of cases) {
      expect(calculateCanonicalQuote(server, PRICING), JSON.stringify(browser)).toEqual(
        deriveCheckoutQuote(browser),
      );
    }
  });
});
