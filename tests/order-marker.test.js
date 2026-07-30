/**
 * Unit tests for resolveScaleMarkerPrice — the order page's estimate-scale marker
 * source. Guards the fix for the shipped bug where the static quoted `estimate`
 * URL param won the marker forever, pinning it at its own position while the
 * customer's condition selects moved the bar around it.
 */
import { describe, it, expect } from 'vitest';
import { resolveScaleMarkerPrice } from '../src/services/lib/order-marker.js';

describe('resolveScaleMarkerPrice', () => {
  it('prefers the quoted estimate on initial load (conditions match, prediction exists)', () => {
    expect(
      resolveScaleMarkerPrice({ estimateAmount: 284, hasPrediction: true, conditionsMatchQuote: true })
    ).toBe(284);
  });

  it('drops the quote once the customer changes the conditions (live prediction wins)', () => {
    // This is the bug: with the old logic the marker stayed at estimateAmount.
    expect(
      resolveScaleMarkerPrice({ estimateAmount: 189, hasPrediction: true, conditionsMatchQuote: false })
    ).toBeNull();
  });

  it('returns null when there is no prediction (conditions "Not sure"), even with a quote', () => {
    expect(
      resolveScaleMarkerPrice({ estimateAmount: 189, hasPrediction: false, conditionsMatchQuote: true })
    ).toBeNull();
    expect(
      resolveScaleMarkerPrice({ estimateAmount: 189, hasPrediction: false, conditionsMatchQuote: false })
    ).toBeNull();
  });

  it('returns null when conditions match + prediction exists but no quote was given', () => {
    // No `estimate` param → let EstimateScale use the local prediction.
    expect(
      resolveScaleMarkerPrice({ estimateAmount: null, hasPrediction: true, conditionsMatchQuote: true })
    ).toBeNull();
  });
});
