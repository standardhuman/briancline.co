/**
 * Unit tests for the graphical estimate scale (estimateScale), the min →
 * predicted → worst-case bar ported from SailorSkills Pro's calculateEstimateRange
 * (PR #410). Like conditions-range.test.js, these assert the scale is a faithful,
 * no-new-rates view of calculateEstimate — they don't re-derive pricing.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateEstimate,
  estimateScale,
  nextSeverityStep,
  SEVERITY_LADDER,
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

describe('SEVERITY_LADDER / nextSeverityStep', () => {
  it('is the ascending distinct set of matrix surcharges', () => {
    expect(SEVERITY_LADDER).toEqual([0, 0.375, 0.5, 0.75, 1.0, 2.0]);
  });

  it('steps up one rung and caps at SEV (2.0)', () => {
    expect(nextSeverityStep(0)).toBe(0.375);
    expect(nextSeverityStep(0.375)).toBe(0.5);
    expect(nextSeverityStep(0.5)).toBe(0.75);
    expect(nextSeverityStep(0.75)).toBe(1.0);
    expect(nextSeverityStep(1.0)).toBe(2.0);
    expect(nextSeverityStep(2.0)).toBe(2.0);
  });
});

describe('estimateScale - applicability', () => {
  it('returns null for non-cleaning services', () => {
    for (const serviceKey of ['underwater_inspection', 'item_recovery', 'propeller_service', 'anodes_only']) {
      expect(estimateScale({ ...CLEANING, serviceKey })).toBeNull();
    }
  });

  it('returns null for an unusable boat length', () => {
    expect(estimateScale({ ...CLEANING, boatLength: 0 })).toBeNull();
    expect(estimateScale({ ...CLEANING, boatLength: '' })).toBeNull();
    expect(estimateScale({ ...CLEANING, boatLength: 'abc' })).toBeNull();
  });

  it('accepts a numeric-string boat length (as the order form supplies)', () => {
    const scale = estimateScale({ ...CLEANING, boatLength: '40' });
    expect(scale).not.toBeNull();
    expect(scale.minPrice).toBeGreaterThan(0);
  });
});

describe('estimateScale - points match calculateEstimate exactly', () => {
  it('min equals the freshly-cleaned (0% growth) estimate', () => {
    const scale = estimateScale({ ...CLEANING, paintAge: '<6mo', lastCleaned: '<2' });
    const clean = calculateEstimate({ ...CLEANING, paintAge: '<6mo', lastCleaned: '<2' });
    expect(scale.minPrice).toBeCloseTo(clean.total);
  });

  it('the marker equals the real estimate at the predicted matrix cell', () => {
    // 2+yr paint / 5-6 months since cleaning => Heavy (0.50).
    const scale = estimateScale({ ...CLEANING, paintAge: '2+yr', lastCleaned: '5-6' });
    const est = calculateEstimate({ ...CLEANING, paintAge: '2+yr', lastCleaned: '5-6' });
    expect(est.fouling.severity).toBe('H');
    expect(scale.hasPrediction).toBe(true);
    expect(scale.predictedPrice).toBeCloseTo(est.total);
    expect(scale.predictedSurcharge).toBe(0.5);
    expect(scale.maxSurcharge).toBe(0.75); // one step above Heavy
  });

  it('worst case is the SEV single-point figure ($567 on a 42′ sail monohull recurring)', () => {
    // Predicted Severe (S, 1.0) at 1.5-2yr / 24+ ; the ceiling steps to SEV 2.0.
    const scale = estimateScale({
      ...CLEANING, boatLength: 42, paintAge: '1.5-2yr', lastCleaned: '24+',
    });
    expect(scale.fouling.severity).toBe('S');
    expect(scale.minPrice).toBeCloseTo(189);       // 42 * 4.5
    expect(scale.predictedPrice).toBeCloseTo(378);  // +100%
    expect(scale.maxPrice).toBeCloseTo(567);        // +200% (SEV cap)
    expect(scale.markerFraction).toBeCloseTo(0.5);
  });
});

describe('estimateScale - marker fraction stays within the bar', () => {
  it('every common matrix cell yields a marker fraction in [0,1]', () => {
    const paintAges = ['<6mo', '6-12mo', '1-1.5yr', '1.5-2yr', '2+yr'];
    const lastCleaneds = ['<2', '2-4', '5-6', '7-8', '9-12', '13-24', '24+'];
    for (const paintAge of paintAges) {
      for (const lastCleaned of lastCleaneds) {
        const scale = estimateScale({ ...CLEANING, paintAge, lastCleaned });
        expect(scale.markerFraction).toBeGreaterThanOrEqual(0);
        expect(scale.markerFraction).toBeLessThanOrEqual(1);
        expect(scale.predictedPrice).toBeGreaterThanOrEqual(scale.minPrice - 0.001);
        expect(scale.predictedPrice).toBeLessThanOrEqual(scale.maxPrice + 0.001);
      }
    }
  });
});

describe('estimateScale - organic visitor / unknown conditions (no marker, per #415)', () => {
  it('has no prediction and NO marker — never a worst-case SEV guess', () => {
    const scale = estimateScale({ ...CLEANING, paintAge: '', lastCleaned: '' });
    expect(scale).not.toBeNull();
    expect(scale.hasPrediction).toBe(false);
    expect(scale.fouling).toBeNull();
    // No matrix cell ⇒ no marker fields at all.
    expect(scale.predictedSurcharge).toBeNull();
    expect(scale.predictedPrice).toBeNull();
    expect(scale.markerFraction).toBeNull();
    // The span is still honest: light (0%) → SEV (200%).
    expect(scale.minSurcharge).toBe(0);
    expect(scale.maxSurcharge).toBe(2.0);
    expect(scale.maxPrice).toBeGreaterThan(scale.minPrice);
  });

  it('a partial capture (only paint, or only last-cleaned) is also markerless', () => {
    const onlyPaint = estimateScale({ ...CLEANING, paintAge: '2+yr', lastCleaned: '' });
    expect(onlyPaint.hasPrediction).toBe(false);
    expect(onlyPaint.predictedPrice).toBeNull();
    expect(onlyPaint.markerFraction).toBeNull();
    expect(onlyPaint.maxSurcharge).toBe(2.0);

    const onlyCleaned = estimateScale({ ...CLEANING, paintAge: '', lastCleaned: '24+' });
    expect(onlyCleaned.hasPrediction).toBe(false);
    expect(onlyCleaned.predictedPrice).toBeNull();
    expect(onlyCleaned.markerFraction).toBeNull();
    expect(onlyCleaned.maxSurcharge).toBe(2.0);
  });

  it('an unknown/garbage condition code does not identify a cell (no marker)', () => {
    const scale = estimateScale({ ...CLEANING, paintAge: 'nope', lastCleaned: 'whenever' });
    expect(scale.hasPrediction).toBe(false);
    expect(scale.predictedPrice).toBeNull();
    expect(scale.markerFraction).toBeNull();
  });
});

describe('estimateScale - respects one-time vs recurring rate', () => {
  it('one-time endpoints are higher than recurring', () => {
    const recurring = estimateScale({ ...CLEANING, frequency: 'monthly', paintAge: '2+yr', lastCleaned: '5-6' });
    const onetime = estimateScale({ ...CLEANING, frequency: 'onetime', paintAge: '2+yr', lastCleaned: '5-6' });
    expect(recurring.isOneTime).toBe(false);
    expect(onetime.isOneTime).toBe(true);
    expect(onetime.minPrice).toBeGreaterThan(recurring.minPrice);
    expect(onetime.maxPrice).toBeGreaterThan(recurring.maxPrice);
  });
});
