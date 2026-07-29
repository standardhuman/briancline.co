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
