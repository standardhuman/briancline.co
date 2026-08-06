export interface OperatorOrderSmsInput {
  orderId: string;
  providerId: string | null;
  orderNumber: string | null;
  boatName: string | null;
  serviceLabel: string | null;
  isTest: boolean;
  stripeLivemode: boolean;
}

export type SendSmsOutcome = 'sent' | 'mock' | 'rate_limited' | 'not_sent' | 'ambiguous';

export type OperatorSmsResult =
  | { status: 'sent' }
  | {
      status: 'skipped';
      reason:
        | 'test'
        | 'missing_recipient'
        | 'missing_sender'
        | 'missing_provider'
        | 'provider_mismatch'
        | 'duplicate';
    }
  | { status: 'not_sent'; reason: 'mock' | 'rate_limited' | 'explicit_not_sent' }
  | { status: 'uncertain'; reason: 'transport' | 'ambiguous_response' | 'claim' | 'release' };

export interface OperatorSmsDeps {
  recipient: string | null;
  providerOwnerUserId: string | null;
  senderConfigured: boolean;
  claim(orderId: string, providerOwnerUserId: string): Promise<string | null>;
  release(orderId: string, providerOwnerUserId: string, claimToken: string): Promise<void>;
  send(to: string, body: string): Promise<SendSmsOutcome>;
  warn(message: string, context: Record<string, unknown>): void;
}

export function buildNewOrderSms(input: OperatorOrderSmsInput): string {
  const order = input.orderNumber?.trim();
  const prefix = order ? `New order ${order}` : 'New order';
  const boat = input.boatName?.trim() || 'New boat';
  const service = input.serviceLabel?.trim() || 'Service';
  return `${prefix}: ${boat} — ${service}. Review: https://pro.sailorskills.com/admin/v2/orders?filter=review`;
}

export function interpretSendSmsResponse(httpStatus: number, json: unknown): SendSmsOutcome {
  if (httpStatus === 429) return 'rate_limited';
  if (!isRecord(json)) return 'ambiguous';
  if (json.mock === true) return 'mock';
  if (
    httpStatus >= 200 &&
    httpStatus < 300 &&
    json.success === true &&
    json.sms_sent === true &&
    json.mock === false
  ) {
    return 'sent';
  }
  if (
    json.sms_sent === false &&
    typeof json.error === 'string' &&
    /^Twilio error: [345][0-9]{2}$/.test(json.error)
  ) {
    return 'not_sent';
  }
  return 'ambiguous';
}

export async function notifyOperatorForSuccessfulOrder(
  input: OperatorOrderSmsInput,
  deps: OperatorSmsDeps,
): Promise<OperatorSmsResult> {
  if (input.isTest || !input.stripeLivemode) {
    return { status: 'skipped', reason: 'test' };
  }
  if (!deps.recipient?.trim()) {
    safeWarn(deps, 'Operator SMS recipient is missing', { orderId: input.orderId });
    return { status: 'skipped', reason: 'missing_recipient' };
  }
  if (!deps.senderConfigured) {
    safeWarn(deps, 'Operator SMS sender is not configured', { orderId: input.orderId });
    return { status: 'skipped', reason: 'missing_sender' };
  }
  if (!deps.providerOwnerUserId?.trim()) {
    safeWarn(deps, 'Operator SMS provider owner is missing', { orderId: input.orderId });
    return { status: 'skipped', reason: 'missing_provider' };
  }
  if (!input.providerId?.trim()) {
    safeWarn(deps, 'Order provider is missing', { orderId: input.orderId });
    return { status: 'skipped', reason: 'missing_provider' };
  }
  if (input.providerId !== deps.providerOwnerUserId) {
    safeWarn(deps, 'Order provider does not match operator provider', { orderId: input.orderId });
    return { status: 'skipped', reason: 'provider_mismatch' };
  }

  let claimToken: string | null;
  try {
    claimToken = await deps.claim(input.orderId, deps.providerOwnerUserId);
  } catch (error) {
    safeWarn(deps, 'Operator SMS claim failed', {
      orderId: input.orderId,
      errorClass: errorClass(error),
    });
    return { status: 'uncertain', reason: 'claim' };
  }
  if (claimToken === null) {
    return { status: 'skipped', reason: 'duplicate' };
  }

  let outcome: SendSmsOutcome;
  try {
    outcome = await deps.send(deps.recipient, buildNewOrderSms(input));
  } catch (error) {
    safeWarn(deps, 'Operator SMS transport outcome is unknown', {
      orderId: input.orderId,
      errorClass: errorClass(error),
    });
    return { status: 'uncertain', reason: 'transport' };
  }

  if (outcome === 'sent') {
    return { status: 'sent' };
  }
  const isDefinitiveNoSend =
    outcome === 'mock' || outcome === 'rate_limited' || outcome === 'not_sent';
  if (!isDefinitiveNoSend) {
    safeWarn(deps, 'Operator SMS response is ambiguous', { orderId: input.orderId });
    return { status: 'uncertain', reason: 'ambiguous_response' };
  }

  try {
    await deps.release(input.orderId, deps.providerOwnerUserId, claimToken);
  } catch (error) {
    safeWarn(deps, 'Operator SMS claim release failed', {
      orderId: input.orderId,
      errorClass: errorClass(error),
    });
    return { status: 'uncertain', reason: 'release' };
  }

  const reason = outcome === 'not_sent' ? 'explicit_not_sent' : outcome;
  return { status: 'not_sent', reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorClass(error: unknown): string {
  return error instanceof Error ? error.constructor.name : typeof error;
}

function safeWarn(
  deps: Pick<OperatorSmsDeps, 'warn'>,
  message: string,
  context: Record<string, unknown>,
): void {
  try {
    deps.warn(message, context);
  } catch {
    // Warning telemetry must never affect webhook handling.
  }
}
