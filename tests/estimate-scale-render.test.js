/**
 * Render-level tests for EstimateScale — they pin the marker contract that the
 * pure-function estimateScale() tests can't reach (the marker lives in the
 * component). Server-rendered (react-dom/server), so no DOM/env is needed and
 * they run in the plain vitest suite alongside the math tests.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EstimateScale from '../src/services/components/EstimateScale.jsx';
import { estimateScale } from '../src/services/lib/diving-calculator.js';
import { resolveScaleMarkerPrice } from '../src/services/lib/order-marker.js';

const CLEANING = {
  serviceKey: 'cleaning',
  boatLength: 42,
  boatType: 'sailboat',
  hullType: 'monohull',
  frequency: 'monthly',
  propellerCount: 1,
  anodeCount: 0,
};

const render = (props) => renderToStaticMarkup(React.createElement(EstimateScale, props));

// Mirrors how DivingOrder derives the scale + marker from URL params + live form
// state, so a change to the condition selects is exercised end-to-end (scale
// recompute + marker-source decision + render) — the layer where the shipped bug
// lived. `initial*` are the URL params; `form*` are the customer's live selects.
function renderOrderScale({ initialPaintAge = '', initialLastCleaned = '', estimateAmount = null, formPaintAge, formLastCleaned }) {
  const paintAge = formPaintAge ?? initialPaintAge;
  const lastCleaned = formLastCleaned ?? initialLastCleaned;
  const scale = estimateScale({ ...CLEANING, paintAge, lastCleaned });
  const conditionsMatchQuote = paintAge === initialPaintAge && lastCleaned === initialLastCleaned;
  const markerPrice = resolveScaleMarkerPrice({
    estimateAmount,
    hasPrediction: !!scale?.hasPrediction,
    conditionsMatchQuote,
  });
  return render({ scale, markerPrice });
}

// The marker pill's horizontal position, as the integer percent EstimateScale
// renders into `style="left:NN%"` (present on both the callout and the track dot).
function markerPct(html) {
  const m = html.match(/left:(\d+)%/);
  return m ? Number(m[1]) : null;
}

describe('EstimateScale - endpoint labels', () => {
  it('labels the ends "minimal growth" and "severe growth"', () => {
    const scale = estimateScale({ ...CLEANING, paintAge: '1.5-2yr', lastCleaned: '13-24' });
    const html = render({ scale, markerPrice: 284 });
    expect(html).toContain('minimal growth');
    expect(html).toContain('severe growth');
    expect(html).not.toContain('Freshly cleaned');
    expect(html).not.toContain('Worst case');
  });
});

describe('EstimateScale - marker contract', () => {
  it('quoted estimate (URL param) wins the marker', () => {
    const scale = estimateScale({ ...CLEANING, paintAge: '1.5-2yr', lastCleaned: '13-24' });
    const html = render({ scale, markerPrice: 284 });
    expect(html).toContain('Our estimate: $284');
  });

  it('with conditions but NO quoted estimate, the marker uses the local prediction', () => {
    // 1.5-2yr / 13-24 => Severe (S) => $378 on a 42′ sail monohull recurring.
    const scale = estimateScale({ ...CLEANING, paintAge: '1.5-2yr', lastCleaned: '13-24' });
    expect(scale.hasPrediction).toBe(true);
    const html = render({ scale }); // no markerPrice
    expect(html).toContain('Our estimate: $378');
  });

  it('with NO conditions AND no quoted estimate, there is NO marker', () => {
    // The unknown-data contract: Pro now omits the estimate param when paint /
    // cleaning are unknown; the bar must not conjure a marker from nothing.
    const scale = estimateScale({ ...CLEANING, paintAge: '', lastCleaned: '' });
    expect(scale.hasPrediction).toBe(false);
    const html = render({ scale }); // no markerPrice
    expect(html).not.toContain('Our estimate');
    // The span still renders.
    expect(html).toContain('minimal growth');
    expect(html).toContain('severe growth');
  });

  it('an invalid/zero quoted estimate does not force a marker when there is no prediction', () => {
    const scale = estimateScale({ ...CLEANING, paintAge: '', lastCleaned: '' });
    expect(render({ scale, markerPrice: 0 })).not.toContain('Our estimate');
    expect(render({ scale, markerPrice: NaN })).not.toContain('Our estimate');
  });
});

describe('order scale marker moves with the condition selects (regression: #18 pinned pill)', () => {
  // Brian's live repro: a capture link with NO condition params but a quoted
  // estimate that happens to equal the light-growth minimum ($189 on a 42' sail
  // monohull recurring). Before the fix the static quote won the marker forever:
  // "$189.00" stuck at the far left (fraction 0) while the bar + tier table
  // reacted to the selects around it.

  it('no conditions on load → no marker, even though a quote is present', () => {
    const html = renderOrderScale({ estimateAmount: 189 }); // no paint/cleaned params
    expect(html).not.toContain('Our estimate');
    expect(html).toContain('minimal growth');
  });

  it('picking paint + last-cleaned moves the marker to the LIVE prediction (not the pinned quote)', () => {
    // Customer selects 1-1.5yr / 9-12 => Heavy (+50%) => $283.50, ~2/3 along the
    // $189→$330.75 span. The old behavior kept "$189.00" at 0%.
    const html = renderOrderScale({
      estimateAmount: 189, // the quote that used to pin the pill
      formPaintAge: '1-1.5yr',
      formLastCleaned: '9-12',
    });
    expect(html).toContain('Our estimate: $283.50');
    expect(html).not.toContain('Our estimate: $189.00');
    // Position tracks the prediction (~67%), nowhere near the far-left 0%.
    expect(markerPct(html)).toBe(67);
  });

  it('clearing the selects back to "Not sure" removes the marker entirely', () => {
    // Started with real URL conditions + quote, then customer clears one select.
    const html = renderOrderScale({
      initialPaintAge: '1.5-2yr',
      initialLastCleaned: '13-24',
      estimateAmount: 284,
      formPaintAge: '', // customer cleared paint age
      formLastCleaned: '13-24',
    });
    expect(html).not.toContain('Our estimate');
    expect(html).toContain('minimal growth');
  });

  it('on initial load with matching URL conditions, the quoted number still wins (texted-number contract)', () => {
    const html = renderOrderScale({
      initialPaintAge: '1.5-2yr',
      initialLastCleaned: '13-24',
      estimateAmount: 284,
      // form unchanged from URL
    });
    expect(html).toContain('Our estimate: $284');
  });

  it('changing conditions away from the URL quote lets the live prediction win over the quote', () => {
    const html = renderOrderScale({
      initialPaintAge: '1.5-2yr',
      initialLastCleaned: '13-24',
      estimateAmount: 284, // quoted for the URL conditions
      formPaintAge: '1-1.5yr', // customer changed it
      formLastCleaned: '9-12',
    });
    expect(html).toContain('Our estimate: $283.50'); // live Heavy prediction
    expect(html).not.toContain('Our estimate: $284');
  });
});
