/**
 * Unit tests for the conditions-based price range (display layer). These cover
 * conditionPriceRange() and conditionDisplayRows() — the helpers that power the
 * "what the price depends on" panels on the estimator and order pages. They do
 * NOT re-derive pricing; they assert the range is a faithful, no-new-rates view
 * of calculateEstimate.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateEstimate,
  conditionPriceRange,
  conditionDisplayRows,
  CONDITION_TIERS,
} from '../src/services/lib/diving-calculator.js';

const CLEANING = {
  serviceKey: 'cleaning',
  boatLength: 40,
  boatType: 'sailboat',
  hullType: 'monohull',
  frequency: 'monthly',
  propellerCount: 1,
  anodeCount: 0,
};

describe('CONDITION_TIERS', () => {
  it('exposes exactly light/moderate/heavy/severe at 0/0/50/100%', () => {
    expect(CONDITION_TIERS.map((t) => t.key)).toEqual([
      'light', 'moderate', 'heavy', 'severe',
    ]);
    expect(CONDITION_TIERS.map((t) => t.surcharge)).toEqual([0, 0, 0.5, 1.0]);
  });
});

describe('conditionPriceRange - applicability', () => {
  it('returns null for non-cleaning services', () => {
    for (const serviceKey of ['underwater_inspection', 'item_recovery', 'propeller_service', 'anodes_only']) {
      expect(conditionPriceRange({ ...CLEANING, serviceKey })).toBeNull();
    }
  });

  it('returns null for an unusable boat length', () => {
    expect(conditionPriceRange({ ...CLEANING, boatLength: 0 })).toBeNull();
    expect(conditionPriceRange({ ...CLEANING, boatLength: '' })).toBeNull();
    expect(conditionPriceRange({ ...CLEANING, boatLength: 'abc' })).toBeNull();
  });

  it('accepts a numeric-string boat length (as the order form supplies)', () => {
    const range = conditionPriceRange({ ...CLEANING, boatLength: '40' });
    expect(range).not.toBeNull();
    expect(range.tiers).toHaveLength(4);
  });
});

describe('conditionPriceRange - tier prices match calculateEstimate exactly', () => {
  // The whole point: no new rates. Each display tier must equal what the real
  // calculator produces at a matrix cell of the corresponding growth surcharge.
  const range = conditionPriceRange({ ...CLEANING, paintAge: '<6mo', lastCleaned: '<2', anodeCount: 2 });
  const tierByKey = Object.fromEntries(range.tiers.map((t) => [t.key, t]));

  it('Light/Moderate (0%) equals the plain base estimate', () => {
    const est = calculateEstimate({ ...CLEANING, paintAge: '<6mo', lastCleaned: '<2', anodeCount: 2 });
    expect(tierByKey.light.total).toBeCloseTo(est.total);
    expect(tierByKey.moderate.total).toBeCloseTo(est.total);
  });

  it('Heavy (50%) equals a real Heavy-condition estimate (2+yr / 5-6)', () => {
    const est = calculateEstimate({ ...CLEANING, paintAge: '2+yr', lastCleaned: '5-6', anodeCount: 2 });
    expect(est.fouling.severity).toBe('H'); // 0.50
    expect(tierByKey.heavy.total).toBeCloseTo(est.total);
  });

  it('Severe (100%) equals a real Severe-condition estimate (2+yr / 24+ is 200%, so use S at 1.5-2yr/24+)', () => {
    const est = calculateEstimate({ ...CLEANING, paintAge: '1.5-2yr', lastCleaned: '24+', anodeCount: 2 });
    expect(est.fouling.severity).toBe('S'); // 1.00
    expect(tierByKey.severe.total).toBeCloseTo(est.total);
  });
});

describe('conditionPriceRange - predicted tier + default range', () => {
  it('predicted Moderate shows Light–Heavy (the spec example)', () => {
    // 6-12mo paint, 5-6 months since cleaning => MOD (0%) => tier index 1.
    const range = conditionPriceRange({ ...CLEANING, paintAge: '6-12mo', lastCleaned: '5-6' });
    expect(range.hasPrediction).toBe(true);
    expect(range.predictedTier.key).toBe('moderate');
    expect(range.lowIndex).toBe(0);  // light
    expect(range.highIndex).toBe(2); // heavy
    expect(range.rangeLow).toBeCloseTo(range.tiers[0].total);
    expect(range.rangeHigh).toBeCloseTo(range.tiers[2].total);
  });

  it('clamps the low end for a Light prediction (fresh paint, just cleaned)', () => {
    const range = conditionPriceRange({ ...CLEANING, paintAge: '<6mo', lastCleaned: '<2' });
    expect(range.predictedTier.key).toBe('light');
    expect(range.lowIndex).toBe(0);
    expect(range.highIndex).toBe(1); // light..moderate (both 0%)
    expect(range.rangeLow).toBeCloseTo(range.rangeHigh);
  });

  it('clamps the high end for a Severe prediction', () => {
    const range = conditionPriceRange({ ...CLEANING, paintAge: '2+yr', lastCleaned: '24+' });
    expect(range.fouling.severity).toBe('SEV');
    expect(range.predictedTier.key).toBe('severe');
    expect(range.lowIndex).toBe(2);  // heavy
    expect(range.highIndex).toBe(3); // severe
  });

  it('the predicted estimate sits within the shown range for the common tiers', () => {
    // For every matrix cell whose severity is not the rare 200% Maximum, the
    // exact estimate must fall inside [rangeLow, rangeHigh] so headline and
    // range never visibly contradict each other.
    const paintAges = ['<6mo', '6-12mo', '1-1.5yr', '1.5-2yr', '2+yr'];
    const lastCleaneds = ['<2', '2-4', '5-6', '7-8', '9-12', '13-24', '24+'];
    for (const paintAge of paintAges) {
      for (const lastCleaned of lastCleaneds) {
        const range = conditionPriceRange({ ...CLEANING, paintAge, lastCleaned });
        if (range.fouling.severity === 'SEV') continue; // 200% tail, disclosed separately
        const est = calculateEstimate({ ...CLEANING, paintAge, lastCleaned });
        expect(est.total).toBeGreaterThanOrEqual(range.rangeLow - 0.001);
        expect(est.total).toBeLessThanOrEqual(range.rangeHigh + 0.001);
      }
    }
  });
});

describe('conditionPriceRange - organic-visitor fallback (no condition inputs)', () => {
  it('has no prediction and spans the full Light–Severe ladder', () => {
    const range = conditionPriceRange({ ...CLEANING, paintAge: '', lastCleaned: '' });
    expect(range).not.toBeNull();
    expect(range.hasPrediction).toBe(false);
    expect(range.predictedTier).toBeNull();
    expect(range.fouling).toBeNull();
    expect(range.rangeLow).toBeCloseTo(range.tiers[0].total);   // light
    expect(range.rangeHigh).toBeCloseTo(range.tiers[3].total);  // severe
  });
});

describe('conditionPriceRange - respects one-time vs recurring rate', () => {
  it('one-time prices are higher than recurring at every tier', () => {
    const recurring = conditionPriceRange({ ...CLEANING, frequency: 'monthly' });
    const onetime = conditionPriceRange({ ...CLEANING, frequency: 'onetime' });
    expect(recurring.isOneTime).toBe(false);
    expect(onetime.isOneTime).toBe(true);
    for (let i = 0; i < recurring.tiers.length; i++) {
      expect(onetime.tiers[i].total).toBeGreaterThan(recurring.tiers[i].total);
    }
  });
});

describe('conditionDisplayRows', () => {
  it('collapses Light + Moderate into one row, yielding 3 rows', () => {
    const range = conditionPriceRange({ ...CLEANING });
    const rows = conditionDisplayRows(range.tiers);
    expect(rows).toHaveLength(3);
    expect(rows[0].label).toBe('Light–Moderate');
    expect(rows[0].keys).toEqual(['light', 'moderate']);
    expect(rows[1].label).toBe('Heavy');
    expect(rows[2].label).toBe('Severe');
  });

  it('rows are in ascending price with matching totals', () => {
    const range = conditionPriceRange({ ...CLEANING });
    const rows = conditionDisplayRows(range.tiers);
    expect(rows[0].total).toBeLessThan(rows[1].total);
    expect(rows[1].total).toBeLessThan(rows[2].total);
    expect(rows[0].total).toBeCloseTo(range.tiers[0].total);
  });

  it('the predicted tier key can be located within exactly one display row', () => {
    const range = conditionPriceRange({ ...CLEANING, paintAge: '2+yr', lastCleaned: '5-6' }); // Heavy
    const rows = conditionDisplayRows(range.tiers);
    const matches = rows.filter((r) => r.keys.includes(range.predictedTier.key));
    expect(matches).toHaveLength(1);
    expect(matches[0].label).toBe('Heavy');
  });
});
