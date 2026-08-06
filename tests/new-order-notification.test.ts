import { expect, it } from 'vitest';
import {
  buildNewOrderSms,
  interpretSendSmsResponse,
  notifyOperatorForSuccessfulOrder,
  type OperatorOrderSmsInput,
  type OperatorSmsDeps,
  type SendSmsOutcome,
} from '../supabase/functions/_shared/new-order-notification';

const liveOrder: OperatorOrderSmsInput = {
  orderId: 'order-1',
  providerId: 'provider-owner-1',
  orderNumber: 'ORD-1042',
  boatName: 'Raindancer II',
  serviceLabel: 'Cleaning & Anodes',
  isTest: false,
  stripeLivemode: true,
};

interface FakeState {
  claims: Array<[string, string]>;
  releases: Array<[string, string, string]>;
  sends: Array<[string, string]>;
  warnings: Array<[string, Record<string, unknown>]>;
}

function fakeDeps(overrides: Partial<OperatorSmsDeps> = {}): { deps: OperatorSmsDeps; state: FakeState } {
  const state: FakeState = { claims: [], releases: [], sends: [], warnings: [] };
  const deps: OperatorSmsDeps = {
    recipient: '+14155550100',
    providerOwnerUserId: 'provider-owner-1',
    senderConfigured: true,
    async claim(orderId, providerOwnerUserId) {
      state.claims.push([orderId, providerOwnerUserId]);
      return 'claim-token-1';
    },
    async release(orderId, providerOwnerUserId, claimToken) {
      state.releases.push([orderId, providerOwnerUserId, claimToken]);
    },
    async send(to, body) {
      state.sends.push([to, body]);
      return 'sent';
    },
    warn(message, context) {
      state.warnings.push([message, context]);
    },
    ...overrides,
  };
  return { deps, state };
}

it('builds the compact review alert', () => {
  const body = buildNewOrderSms(liveOrder);
  expect(body).toBe(
    'New order ORD-1042: Raindancer II — Cleaning & Anodes. Review: https://pro.sailorskills.com/admin/v2/orders?filter=review',
  );
  expect(body).not.toContain('@');
  expect(body).not.toContain('+1415');
});

it('uses safe fallbacks without including customer or payment data', () => {
  const body = buildNewOrderSms({
    ...liveOrder,
    orderNumber: ' ',
    boatName: null,
    serviceLabel: '\t',
  });
  expect(body).toBe(
    'New order: New boat — Service. Review: https://pro.sailorskills.com/admin/v2/orders?filter=review',
  );
  expect(body).not.toMatch(/customer|payment|email|phone/i);
});

it('classifies only explicit no-send responses as releasable', () => {
  expect(interpretSendSmsResponse(200, { success: true, sms_sent: true, mock: false })).toBe('sent');
  expect(interpretSendSmsResponse(200, { success: false, sms_sent: false, mock: false, error: 'Twilio error: 400' })).toBe('not_sent');
  expect(interpretSendSmsResponse(200, { success: false, sms_sent: false, mock: false, error: 'Failed to reach Twilio' })).toBe('ambiguous');
  expect(interpretSendSmsResponse(200, { success: true, sms_sent: true, mock: true })).toBe('mock');
  expect(interpretSendSmsResponse(429, { error: 'rate limited' })).toBe('rate_limited');
  expect(interpretSendSmsResponse(500, { error: 'down' })).toBe('ambiguous');
  expect(interpretSendSmsResponse(502, null)).toBe('ambiguous');
  expect(interpretSendSmsResponse(200, { success: false, sms_sent: false, mock: false })).toBe('ambiguous');
  expect(interpretSendSmsResponse(200, { success: false, sms_sent: false, mock: false, error: 'Twilio error: 200' })).toBe('ambiguous');
});

it('skips test and non-live orders before claiming', async () => {
  for (const input of [
    { ...liveOrder, isTest: true },
    { ...liveOrder, stripeLivemode: false },
  ]) {
    const { deps, state } = fakeDeps();
    await expect(notifyOperatorForSuccessfulOrder(input, deps)).resolves.toEqual({ status: 'skipped', reason: 'test' });
    expect(state.claims).toEqual([]);
  }
});

it('skips blank configured providers before claiming', async () => {
  const { deps, state } = fakeDeps({ providerOwnerUserId: '  ' });
  await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toEqual({ status: 'skipped', reason: 'missing_provider' });
  expect(state.claims).toEqual([]);
  expect(state.warnings).toHaveLength(1);
});

it('skips missing or blank order providers before claiming', async () => {
  for (const providerId of [null, '  ']) {
    const { deps, state } = fakeDeps();
    await expect(notifyOperatorForSuccessfulOrder({ ...liveOrder, providerId }, deps)).resolves.toEqual({ status: 'skipped', reason: 'missing_provider' });
    expect(state.claims).toEqual([]);
    expect(state.warnings).toHaveLength(1);
  }
});

it('skips foreign providers before claiming', async () => {
  const { deps, state } = fakeDeps();
  await expect(notifyOperatorForSuccessfulOrder({ ...liveOrder, providerId: 'foreign-owner' }, deps)).resolves.toEqual({ status: 'skipped', reason: 'provider_mismatch' });
  expect(state.claims).toEqual([]);
  expect(state.warnings).toHaveLength(1);
});

it('skips missing recipient and sender configuration before claiming', async () => {
  const cases: Array<[Partial<OperatorSmsDeps>, string]> = [
    [{ recipient: ' ' }, 'missing_recipient'],
    [{ senderConfigured: false }, 'missing_sender'],
  ];
  for (const [overrides, reason] of cases) {
    const { deps, state } = fakeDeps(overrides);
    await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toEqual({ status: 'skipped', reason });
    expect(state.claims).toEqual([]);
    expect(state.warnings).toHaveLength(1);
  }
});

it('uses the configured provider owner id for claim and treats null as duplicate', async () => {
  const { deps, state } = fakeDeps({
    async claim(orderId, providerOwnerUserId) {
      state.claims.push([orderId, providerOwnerUserId]);
      return null;
    },
  });
  await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toEqual({ status: 'skipped', reason: 'duplicate' });
  expect(state.claims).toEqual([['order-1', 'provider-owner-1']]);
  expect(state.sends).toEqual([]);
});

it('retains the claim after a successful send', async () => {
  const { deps, state } = fakeDeps();
  await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toEqual({ status: 'sent' });
  expect(state.sends).toEqual([['+14155550100', 'New order ORD-1042: Raindancer II — Cleaning & Anodes. Review: https://pro.sailorskills.com/admin/v2/orders?filter=review']]);
  expect(state.releases).toEqual([]);
});

it('releases explicit non-delivery outcomes with the configured provider owner id', async () => {
  const cases: Array<[SendSmsOutcome, string]> = [
    ['mock', 'mock'],
    ['rate_limited', 'rate_limited'],
    ['not_sent', 'explicit_not_sent'],
  ];
  for (const [outcome, reason] of cases) {
    const { deps, state } = fakeDeps({ send: async () => outcome });
    await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toEqual({ status: 'not_sent', reason });
    expect(state.claims).toEqual([['order-1', 'provider-owner-1']]);
    expect(state.releases).toEqual([['order-1', 'provider-owner-1', 'claim-token-1']]);
  }
});

it('retains the claim and reports uncertainty when release fails', async () => {
  const { deps, state } = fakeDeps({
    send: async () => 'not_sent',
    async release(orderId, providerOwnerUserId, claimToken) {
      state.releases.push([orderId, providerOwnerUserId, claimToken]);
      throw new Error('database unavailable');
    },
  });
  await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toEqual({ status: 'uncertain', reason: 'release' });
  expect(state.releases).toEqual([['order-1', 'provider-owner-1', 'claim-token-1']]);
  expect(state.warnings).toHaveLength(1);
});

it('retains the claim for an ambiguous response', async () => {
  const { deps, state } = fakeDeps({ send: async () => 'ambiguous' });
  await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toEqual({ status: 'uncertain', reason: 'ambiguous_response' });
  expect(state.releases).toEqual([]);
  expect(state.warnings).toHaveLength(1);
});

it('contains claim failures and does not release', async () => {
  const { deps, state } = fakeDeps({ claim: async () => { throw new TypeError('database unavailable'); } });
  await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toEqual({ status: 'uncertain', reason: 'claim' });
  expect(state.releases).toEqual([]);
  expect(state.warnings).toHaveLength(1);
});

it('contains send failures, retains the claim, and warns with only the error class', async () => {
  const { deps, state } = fakeDeps({ send: async () => { throw new TypeError('secret transport detail'); } });
  await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toEqual({ status: 'uncertain', reason: 'transport' });
  expect(state.releases).toEqual([]);
  expect(state.warnings).toHaveLength(1);
  expect(state.warnings[0][1]).toMatchObject({ errorClass: 'TypeError' });
  expect(JSON.stringify(state.warnings)).not.toContain('secret transport detail');
});
