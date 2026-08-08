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

it('retains the claim for an unexpected runtime sender outcome', async () => {
  const { deps, state } = fakeDeps({
    send: async () => 'unexpected' as unknown as SendSmsOutcome,
  });
  await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toEqual({
    status: 'uncertain',
    reason: 'ambiguous_response',
  });
  expect(state.releases).toEqual([]);
  expect(state.warnings).toHaveLength(1);
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

it('duplicate successful webhooks send once', async () => {
  const state = { claimed: false, sends: 0 };
  const { deps } = fakeDeps({
    claim: async () => state.claimed ? null : (state.claimed = true, 'claim-1'),
    send: async () => (state.sends += 1, 'sent'),
  });

  await notifyOperatorForSuccessfulOrder(liveOrder, deps);
  await notifyOperatorForSuccessfulOrder(liveOrder, deps);

  expect(state.sends).toBe(1);
});

it('explicit no-send releases only its own claim', async () => {
  const released: Array<[string, string, string]> = [];
  const { deps } = fakeDeps({
    claim: async () => 'claim-1',
    send: async () => 'not_sent',
    release: async (orderId, providerId, token) => { released.push([orderId, providerId, token]); },
  });

  await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toMatchObject({ status: 'not_sent' });
  expect(released).toEqual([['order-1', 'provider-owner-1', 'claim-1']]);
});

it('ambiguous transport failure retains its claim', async () => {
  const releases: unknown[] = [];
  const { deps } = fakeDeps({
    claim: async () => 'claim-1',
    send: async () => { throw new TypeError('network failure'); },
    release: async (...args) => { releases.push(args); },
  });

  await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toMatchObject({ status: 'uncertain' });
  expect(releases).toEqual([]);
});

it('retains its claim for timeout and every ambiguous send-sms response shape', async () => {
  const ambiguousSenders: Array<() => Promise<SendSmsOutcome>> = [
    async () => { throw Object.assign(new Error('timed out'), { name: 'AbortError' }); },
    async () => interpretSendSmsResponse(200, null),
    async () => interpretSendSmsResponse(500, {
      success: false,
      sms_sent: false,
      mock: false,
      error: 'Failed to reach Twilio',
    }),
    async () => interpretSendSmsResponse(200, { sms_sent: false }),
    async () => interpretSendSmsResponse(503, { success: false, error: 'temporarily unavailable' }),
  ];

  for (const send of ambiguousSenders) {
    const { deps, state } = fakeDeps({ claim: async () => 'claim-1', send });
    const result = await notifyOperatorForSuccessfulOrder(liveOrder, deps);
    expect(result.status).toBe('uncertain');
    expect(state.releases).toEqual([]);
  }
});

it('releases its exact claim for each pinned definitive send-sms rejection', async () => {
  const definitiveSenders: Array<() => Promise<SendSmsOutcome>> = [
    async () => interpretSendSmsResponse(200, { success: true, sms_sent: true, mock: true }),
    async () => interpretSendSmsResponse(429, { error: 'rate limited' }),
    async () => interpretSendSmsResponse(200, {
      success: false,
      sms_sent: false,
      mock: false,
      error: 'Twilio error: 400',
    }),
  ];

  for (const send of definitiveSenders) {
    const { deps, state } = fakeDeps({ claim: async () => 'claim-1', send });
    await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toMatchObject({ status: 'not_sent' });
    expect(state.releases).toEqual([['order-1', 'provider-owner-1', 'claim-1']]);
  }
});

it.each([
  ['database error', 'operator SMS release failed: database unavailable'],
  ['token mismatch', 'operator SMS release matched no retained claim'],
])('retains a claim after a %s during release and blocks a later retry', async (_label, releaseMessage) => {
  const state = { claimed: false, sends: 0, releases: 0 };
  const { deps } = fakeDeps({
    claim: async () => state.claimed ? null : (state.claimed = true, 'claim-1'),
    send: async () => (state.sends += 1, 'not_sent'),
    release: async () => {
      state.releases += 1;
      throw new Error(releaseMessage);
    },
  });

  await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toEqual({
    status: 'uncertain',
    reason: 'release',
  });
  await expect(notifyOperatorForSuccessfulOrder(liveOrder, deps)).resolves.toEqual({
    status: 'skipped',
    reason: 'duplicate',
  });
  expect(state).toEqual({ claimed: true, sends: 1, releases: 1 });
});

it('foreign or missing configured providers never claim or send', async () => {
  for (const [input, overrides] of [
    [{ ...liveOrder, providerId: 'foreign-provider' }, {}],
    [liveOrder, { providerOwnerUserId: null }],
  ] as Array<[OperatorOrderSmsInput, Partial<OperatorSmsDeps>]>) {
    const { deps, state } = fakeDeps(overrides);
    await notifyOperatorForSuccessfulOrder(input, deps);
    expect(state.claims).toEqual([]);
    expect(state.sends).toEqual([]);
  }
});

it('keeps email and SMS claims independent across a rejected delivery and replay', async () => {
  const state = {
    confirmationEmailClaim: null as string | null,
    confirmationEmailWrites: [] as Array<string | null>,
    emailSends: 0,
    smsClaim: null as string | null,
    smsAttempts: 0,
    confirmedSms: 0,
  };

  const deps: OperatorSmsDeps = {
    ...fakeDeps().deps,
    async claim() {
      if (state.smsClaim) return null;
      state.smsClaim = `sms-claim-${state.smsAttempts + 1}`;
      return state.smsClaim;
    },
    async release(_orderId, _providerOwnerUserId, claimToken) {
      if (state.smsClaim !== claimToken) throw new Error('token mismatch');
      state.smsClaim = null;
    },
    async send() {
      state.smsAttempts += 1;
      if (state.smsAttempts === 1) return 'not_sent';
      state.confirmedSms += 1;
      return 'sent';
    },
  };

  async function handleSuccessfulEvent(): Promise<void> {
    if (state.confirmationEmailClaim === null) {
      state.confirmationEmailClaim = 'email-claim-1';
      state.confirmationEmailWrites.push('email-claim-1');
      state.emailSends += 1;
    }
    await notifyOperatorForSuccessfulOrder(liveOrder, deps);
  }

  await handleSuccessfulEvent();
  await handleSuccessfulEvent();

  expect(state.emailSends).toBe(1);
  expect(state.smsAttempts).toBe(2);
  expect(state.confirmedSms).toBe(1);
  expect(state.confirmationEmailWrites).toEqual(['email-claim-1']);
  expect(state.confirmationEmailWrites).not.toContain(null);
  expect(state.smsClaim).toBe('sms-claim-2');
});
