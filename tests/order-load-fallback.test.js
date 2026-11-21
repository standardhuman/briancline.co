/**
 * The order page must never spin forever. If the Stripe config call to
 * Supabase fails or hangs, it shows a fallback with email and phone.
 * (Oct 2026: a retired Supabase key made the form spin for weeks.)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadStripeConfig } from '../src/services/lib/stripe-config-loader.js';
import OrderUnavailable from '../src/services/components/OrderUnavailable.jsx';

const okResponse = (body) => ({ ok: true, status: 200, json: async () => body });
const base = { supabaseUrl: 'https://example.supabase.co', headers: { apikey: 'k' } };

describe('loadStripeConfig', () => {
  it('loads Stripe with the publishable key from the edge function', async () => {
    const fetchImpl = vi.fn(async () => okResponse({ publishableKey: 'pk_live_abc' }));
    const loadStripe = vi.fn(async () => ({ stripe: true }));
    await expect(loadStripeConfig({ ...base, fetchImpl, loadStripe })).resolves.toEqual({ stripe: true });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://example.supabase.co/functions/v1/get-stripe-config');
    expect(fetchImpl.mock.calls[0][1].headers).toEqual({ apikey: 'k' });
    expect(loadStripe).toHaveBeenCalledWith('pk_live_abc');
  });

  it('rejects on a non-OK response, like a retired key (401)', async () => {
    const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ message: 'Invalid API key' }) });
    const loadStripe = vi.fn();
    await expect(loadStripeConfig({ ...base, fetchImpl, loadStripe })).rejects.toThrow('HTTP 401');
    expect(loadStripe).not.toHaveBeenCalled();
  });

  it('rejects when the response has no publishable key', async () => {
    const fetchImpl = async () => okResponse({ error: 'nope' });
    await expect(loadStripeConfig({ ...base, fetchImpl, loadStripe: vi.fn() })).rejects.toThrow('no publishable key');
  });

  it('rejects when Stripe.js fails to load', async () => {
    const fetchImpl = async () => okResponse({ publishableKey: 'pk_test_x' });
    await expect(loadStripeConfig({ ...base, fetchImpl, loadStripe: async () => null })).rejects.toThrow('Stripe.js did not load');
  });

  it('rejects when the network call fails', async () => {
    const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
    await expect(loadStripeConfig({ ...base, fetchImpl, loadStripe: vi.fn() })).rejects.toThrow('Failed to fetch');
  });

  it('rejects when the Supabase URL is missing from the build', async () => {
    await expect(loadStripeConfig({ ...base, supabaseUrl: undefined, loadStripe: vi.fn() })).rejects.toThrow('Supabase URL');
  });

  it('times out and aborts a request that never answers', async () => {
    let signal;
    const fetchImpl = (_url, opts) => { signal = opts.signal; return new Promise(() => {}); };
    await expect(loadStripeConfig({ ...base, fetchImpl, loadStripe: vi.fn(), timeoutMs: 20 })).rejects.toThrow('timed out');
    expect(signal.aborted).toBe(true);
  });
});

describe('OrderUnavailable fallback', () => {
  const html = renderToStaticMarkup(React.createElement(OrderUnavailable, { onRetry: () => {} }));

  it('gives the customer email and phone', () => {
    expect(html).toContain('href="mailto:diving@briancline.co');
    expect(html).toContain('href="tel:+1-415-529-0272"');
    expect(html).toContain('(415) 529-0272');
  });

  it('is marked for the live smoke check and offers a retry', () => {
    expect(html).toContain('data-testid="order-unavailable"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Try again');
  });
});

describe('DivingOrder wiring', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/services/pages/DivingOrder.jsx', import.meta.url)),
    'utf8',
  );

  it('loads Stripe through the guarded loader, not a bare fetch', () => {
    expect(source).toContain('loadStripeConfig({');
    expect(source).not.toMatch(/\.then\(\(\{ publishableKey \}\) => loadStripe/);
  });

  it('renders the fallback when the load fails, and marks the ready form', () => {
    expect(source).toMatch(/if \(loadFailed\) \{\s*return \(\s*<OrderUnavailable/);
    expect(source).toContain('data-testid="order-form"');
  });
});
