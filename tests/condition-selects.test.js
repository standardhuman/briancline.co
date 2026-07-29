/**
 * Render-level tests for ConditionSelects — the customer-editable Bottom Paint
 * Age / Last Cleaned selects on the order form. Server-rendered
 * (react-dom/server) so no DOM env is needed, matching estimate-scale-render.
 *
 * These pin the field set + "Not sure" default + prefill contract that the
 * order form's live-narrowing behavior depends on.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ConditionSelects from '../src/services/components/ConditionSelects.jsx';
import {
  PAINT_AGE_OPTIONS,
  LAST_CLEANED_OPTIONS,
} from '../src/services/lib/diving-calculator.js';

const noop = () => {};
const render = (props) =>
  renderToStaticMarkup(
    React.createElement(ConditionSelects, {
      paintAge: '',
      lastCleaned: '',
      onPaintAgeChange: noop,
      onLastCleanedChange: noop,
      ...props,
    })
  );

// Labels of the options React marks `selected`, in DOM order (paint select
// first, then last-cleaned select).
function selectedLabels(html) {
  const out = [];
  const re = /<option[^>]*\bselected\b[^>]*>([^<]*)<\/option>/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

describe('ConditionSelects - field set + vocabulary', () => {
  it('renders both selects with a "Not sure" option and the shared vocabulary', () => {
    const html = render({});
    expect(html).toContain('data-testid="condition-selects"');
    expect(html).toContain('data-testid="paint-age-select"');
    expect(html).toContain('data-testid="last-cleaned-select"');
    // One "Not sure" option per select (the copy above also says "Not sure?",
    // so match the option tag specifically).
    expect((html.match(/>Not sure<\/option>/g) || []).length).toBe(2);
    // Every estimator option label is offered here too (same vocabulary). React
    // HTML-escapes '<' in labels like "< 6 months", so escape when matching.
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    for (const o of PAINT_AGE_OPTIONS) expect(html).toContain(`>${esc(o.label)}</option>`);
    for (const o of LAST_CLEANED_OPTIONS) expect(html).toContain(`>${esc(o.label)}</option>`);
    // Values are the matrix codes (tolerate HTML-escaping of '<').
    const hasValue = (v) => html.includes(`value="${v}"`) || html.includes(`value="${esc(v)}"`);
    for (const o of PAINT_AGE_OPTIONS) expect(hasValue(o.value), o.value).toBe(true);
    for (const o of LAST_CLEANED_OPTIONS) expect(hasValue(o.value), o.value).toBe(true);
  });
});

describe('ConditionSelects - default + prefill', () => {
  it('defaults to "Not sure" in both selects when values are empty', () => {
    expect(selectedLabels(render({ paintAge: '', lastCleaned: '' }))).toEqual([
      'Not sure',
      'Not sure',
    ]);
  });

  it('prefills the selected option from the given values', () => {
    const html = render({ paintAge: '1.5-2yr', lastCleaned: '13-24' });
    expect(selectedLabels(html)).toEqual(['1.5–2 years', '1–2 years']);
  });

  it('a partial prefill selects one option and leaves the other on "Not sure"', () => {
    expect(selectedLabels(render({ paintAge: '2+yr', lastCleaned: '' }))).toEqual([
      '2+ years',
      'Not sure',
    ]);
  });
});
