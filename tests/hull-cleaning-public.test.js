/**
 * The public rate card, the quote API and the /hull-cleaning estimator must
 * always agree. These tests tie all three to diving-calculator.js.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  calculateEstimate,
  conditionPriceRange,
  lookupFouling,
  RATES,
  SURCHARGES,
  RUNNING_GEAR_MULTIPLIER,
  PAINT_AGE_OPTIONS,
  LAST_CLEANED_OPTIONS,
} from '../src/services/lib/diving-calculator.js';
import {
  buildPricingSummary,
  parseQuoteQuery,
  buildQuote,
  INPUT_OPTIONS,
  PROMOTION,
} from '../src/services/lib/hull-cleaning-public.js';
import { PRICING_JSON_PATH, pricingJsonText } from '../scripts/generate-pricing-json.mjs';
import handler from '../api/hull-cleaning-quote.js';

const round2 = (n) => Math.round(n * 100) / 100;

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}

describe('pricing summary', () => {
  const summary = buildPricingSummary();

  it('takes every rate from the calculator', () => {
    const svc = Object.fromEntries(summary.services.map((s) => [s.key, s]));
    expect(svc.cleaning.pricing.recurringPerFoot).toBe(RATES.recurring);
    expect(svc.cleaning.pricing.oneTimePerFoot).toBe(RATES.onetime);
    expect(svc.running_gear.pricing.fractionOfCleaning).toBe(RUNNING_GEAR_MULTIPLIER);
    expect(svc.underwater_inspection.pricing.perFoot).toBe(RATES.inspection);
    expect(svc.item_recovery.pricing.from).toBe(RATES.itemRecovery);
    expect(svc.propeller_service.pricing.perPropeller).toBe(RATES.propellerService);
    expect(svc.anodes_only.pricing.perAnode).toBe(RATES.anode);
    expect(summary.minimumCharge.amount).toBe(RATES.minimum);
    expect(summary.surcharges.boatAndHull).toMatchObject(SURCHARGES);
  });

  it('publishes the propeller surcharge the calculator charges', () => {
    const one = calculateEstimate({ boatLength: 40, propellerCount: 1 });
    const two = calculateEstimate({ boatLength: 40, propellerCount: 2 });
    const base = RATES.recurring * 40;
    expect(two.total - one.total).toBeCloseTo(base * summary.surcharges.eachAdditionalPropeller.surcharge);
  });

  it('publishes the exact growth matrix the calculator uses', () => {
    const { matrix } = summary.growth;
    LAST_CLEANED_OPTIONS.forEach((l, r) => {
      PAINT_AGE_OPTIONS.forEach((p, c) => {
        expect(matrix.cells[r][c].surcharge).toBe(lookupFouling(p.value, l.value).surcharge);
      });
    });
  });

  it('serves Berkeley Marina only', () => {
    expect(summary.serviceArea.marinas).toEqual(['Berkeley Marina, Berkeley, California']);
  });

  it('committed public/pricing/hull-cleaning.json is up to date (run: node scripts/generate-pricing-json.mjs)', () => {
    expect(readFileSync(PRICING_JSON_PATH, 'utf8')).toBe(pricingJsonText());
  });
});

describe('parseQuoteQuery', () => {
  it('applies defaults and requires length for per-foot services', () => {
    expect(parseQuoteQuery({ length: '35' })).toEqual({
      ok: true,
      input: {
        service: 'cleaning', length: 35, boatType: 'sailboat', hull: 'monohull', frequency: 'monthly',
        propellers: 1, anodes: 0, paintAge: null, lastCleaned: null,
      },
    });
    const missing = parseQuoteQuery({});
    expect(missing.ok).toBe(false);
    expect(missing.errors.join(' ')).toMatch(/length is required/);
  });

  it('does not need a length for flat-rate services', () => {
    expect(parseQuoteQuery({ service: 'item_recovery' }).ok).toBe(true);
  });

  it('accepts the order form spelling of one-time', () => {
    expect(parseQuoteQuery({ length: '30', frequency: 'one_time' }).input.frequency).toBe('onetime');
  });

  it('rejects unknown values and out-of-range numbers', () => {
    const r = parseQuoteQuery({ service: 'detailing', length: '0', propellers: '9', paintAge: 'old' });
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(4);
  });
});

describe('buildQuote matches the estimator', () => {
  const cases = [];
  for (const service of ['cleaning', 'running_gear', 'underwater_inspection', 'item_recovery', 'propeller_service', 'anodes_only']) {
    for (const frequency of INPUT_OPTIONS.frequency) {
      for (const [boatType, hull] of [['sailboat', 'monohull'], ['powerboat', 'catamaran'], ['sailboat', 'trimaran']]) {
        cases.push({ service, length: 34, boatType, hull, frequency, propellers: 2, anodes: 3, paintAge: '1.5-2yr', lastCleaned: '7-8' });
      }
    }
  }

  it.each(cases)('$service $frequency $boatType $hull', (input) => {
    const q = buildQuote(input);
    const est = calculateEstimate({
      serviceKey: input.service, boatLength: input.length, boatType: input.boatType, hullType: input.hull,
      frequency: input.frequency, propellerCount: input.propellers, paintAge: input.paintAge,
      lastCleaned: input.lastCleaned, anodeCount: input.anodes,
    });
    expect(q.estimate.total).toBe(round2(est.total));
    expect(q.estimate.lineItems.map((i) => i.amount)).toEqual(est.items.map((i) => round2(i.amount)));
  });

  it('prices unknown conditions at light growth and shows the full range', () => {
    const q = buildQuote(parseQuoteQuery({ length: '35' }).input);
    expect(q.estimate.total).toBe(157.5);
    const range = conditionPriceRange({ boatLength: 35, paintAge: '', lastCleaned: '' });
    expect(q.conditionRange.low).toBe(round2(range.rangeLow));
    expect(q.conditionRange.high).toBe(round2(range.rangeHigh));
    expect(q.conditionRange.expected).toBeNull();
  });

  it('links to a prefilled order form and carries the offer', () => {
    const q = buildQuote(parseQuoteQuery({ length: '35', frequency: 'onetime', paintAge: '<6mo', lastCleaned: '2-4' }).input);
    const url = new URL(q.orderUrl);
    expect(url.pathname).toBe('/hull-cleaning/order');
    expect(url.searchParams.get('frequency')).toBe('one_time');
    expect(url.searchParams.get('estimate')).toBe(String(Math.round(q.estimate.total)));
    expect(q.promotion).toEqual(PROMOTION);
  });
});

describe('GET /api/hull-cleaning-quote', () => {
  it('returns a quote with open CORS and caching', () => {
    const res = mockRes();
    handler({ method: 'GET', query: { length: '35' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.estimate.total).toBe(157.5);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['cache-control']).toMatch(/s-maxage/);
  });

  it('returns 400 with details for bad input', () => {
    const res = mockRes();
    handler({ method: 'GET', query: { length: 'abc' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('is read-only', () => {
    const res = mockRes();
    handler({ method: 'POST', query: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});
