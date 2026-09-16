import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(here, '../supabase/functions/create-payment-intent/index.ts'),
  'utf8',
);

/**
 * supabase-js RETURNS errors rather than throwing, so `await supabase.from(x).insert(y)`
 * with the result discarded swallows the failure silently: the request completes, the
 * customer is charged, and the row never exists. These are source-text assertions
 * because the edge function is Deno and cannot be imported here — the same convention
 * create-payment-intent-quote-contract.test.ts uses.
 */
describe('create-payment-intent checkout write error handling', () => {
  it('leaves no fire-and-forget supabase write on the checkout path', () => {
    // The regression guard that matters: a bare `await supabase…` statement is a
    // write whose { error } is discarded. Adding one should fail this test.
    const bareAwaits = source
      .split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter((entry) => /^await supabase\b/.test(entry.line));

    expect(
      bareAwaits.map((e) => `${e.number}: ${e.line}`),
      'every supabase write must destructure { error } and report it',
    ).toEqual([]);
  });

  it('defines one greppable, non-throwing failure logger', () => {
    expect(source).toContain('function logCheckoutWriteFailure(');
    expect(source).toContain('[checkout-write-failed]');
    // Must log rather than throw: these run after the order exists and the setup
    // intent is in flight, so failing the request is worse than a missing row.
    const helper = source.slice(
      source.indexOf('function logCheckoutWriteFailure('),
      source.indexOf('function providerOwnerLookup('),
    );
    expect(helper).toContain('console.error');
    expect(helper).not.toContain('throw');
  });

  it('reports a failure for every bookkeeping write on the checkout path', () => {
    for (const table of [
      'customers',
      'addresses',
      'boats',
      'marinas',
      'service_schedules',
      'customer_services',
      'service_orders',
    ]) {
      expect(source, `no failure log for ${table}`).toContain(`logCheckoutWriteFailure('${table}'`);
    }
  });

  it('identifies the affected row by order number once one exists', () => {
    // service_schedules / customer_services / the order-linking update all run
    // after `orderNumber` is generated, so the log must carry it.
    for (const table of ['service_schedules', 'customer_services', 'service_orders']) {
      expect(source).toContain(`logCheckoutWriteFailure('${table}', orderNumber`);
    }
  });

  it('falls back to the customer email for writes that precede the order number', () => {
    // customers / addresses / boats / marinas are written before the order row,
    // so there is no order number yet — the email is the identifying reference.
    for (const table of ['customers', 'addresses', 'boats', 'marinas']) {
      expect(source).toContain(`logCheckoutWriteFailure('${table}', \`email:\${formData.customerEmail}\``);
    }
    // And the order number genuinely is generated after them.
    expect(source.indexOf('const orderNumber =')).toBeGreaterThan(
      source.indexOf("logCheckoutWriteFailure('addresses'"),
    );
  });

  it('keeps the recurring-schedule write non-fatal so the order still completes', () => {
    const scheduleWrite = source.slice(
      source.indexOf("supabase.from('service_schedules').insert"),
      source.indexOf('const serviceTypeMap'),
    );
    expect(scheduleWrite).toContain('scheduleError');
    expect(scheduleWrite).toContain("logCheckoutWriteFailure('service_schedules', orderNumber");
    expect(scheduleWrite).not.toContain('throw');
  });

  it('still fails hard on the writes that must not be lost', () => {
    // Unchanged by this PR: the order row and the authorization row are load-bearing
    // for billing and chargeback defense, and still abort the request.
    expect(source).toContain('if (orderError) throw orderError');
    expect(source).toContain("throw new Error('Could not record authorization')");
  });
});
