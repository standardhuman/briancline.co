import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const createPaymentIntentSource = readFileSync(
  new URL('../supabase/functions/create-payment-intent/index.ts', import.meta.url),
  'utf8',
);
const webhookSource = readFileSync(
  new URL('../supabase/functions/diving-stripe-webhook/index.ts', import.meta.url),
  'utf8',
);
const notificationSource = readFileSync(
  new URL('../supabase/functions/_shared/new-order-notification.ts', import.meta.url),
  'utf8',
);

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, `missing source marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing source marker: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('successful-order SMS webhook contract', () => {
  it('is absent from order creation and imported only by the signed webhook', () => {
    expect(createPaymentIntentSource).not.toContain('notifyOperatorForSuccessfulOrder');
    expect(webhookSource).toMatch(
      /import\s*\{[\s\S]*notifyOperatorForSuccessfulOrder[\s\S]*\}\s*from\s*['"]\.\.\/_shared\/new-order-notification\.ts['"]/,
    );
    const succeededHandler = sourceBetween(
      webhookSource,
      'async function handleSetupIntentSucceeded',
      'async function sendOrderEmails',
    );
    expect(succeededHandler).toContain('notifyOperatorForSuccessfulOrder(');
  });

  it('runs an SMS-only lookup after the independent email claim branch', () => {
    const emailDuplicateIndex = webhookSource.indexOf('Confirmation email already sent');
    const smsLookupIndex = webhookSource.indexOf('const { data: orderForSms');
    expect(emailDuplicateIndex).toBeGreaterThanOrEqual(0);
    expect(smsLookupIndex).toBeGreaterThan(emailDuplicateIndex);

    const smsPath = sourceBetween(
      webhookSource,
      'const { data: orderForSms',
      'if (authRow.is_recurring)',
    );
    expect(smsPath).toContain(".select('id, provider_id, order_number, service_type, is_test, boats(name)')");
    expect(smsPath).not.toContain('orderForEmail');
  });

  it('defers an email send failure until after the independent SMS branch', () => {
    const succeededHandler = sourceBetween(
      webhookSource,
      'async function handleSetupIntentSucceeded',
      'async function sendOrderEmails',
    );
    const emailCatchIndex = succeededHandler.indexOf('} catch (emailErr: any) {');
    const smsBranchIndex = succeededHandler.indexOf('if (!operatorSmsConfigValid)');
    const deferredThrowIndex = succeededHandler.indexOf('throw confirmationEmailError');

    expect(succeededHandler).toContain('let confirmationEmailError: Error | null = null');
    expect(emailCatchIndex).toBeGreaterThanOrEqual(0);
    expect(smsBranchIndex).toBeGreaterThan(emailCatchIndex);
    expect(deferredThrowIndex).toBeGreaterThan(smsBranchIndex);
    expect(succeededHandler.slice(emailCatchIndex, smsBranchIndex)).not.toContain(
      'throw new Error(`Confirmation email send failed:',
    );
  });

  it('requires trimmed configuration before lookup and scopes every mutation to the configured provider', () => {
    expect(webhookSource).toMatch(/ORDER_NOTIFY_PHONE_E164[\s\S]*\.trim\(\)/);
    expect(webhookSource).toMatch(/DEFAULT_PROVIDER_OWNER_USER_ID[\s\S]*\.trim\(\)/);
    expect(webhookSource).toMatch(/SUPABASE_URL[\s\S]*\.trim\(\)/);
    expect(webhookSource).toMatch(/SUPABASE_SERVICE_ROLE_KEY[\s\S]*\.trim\(\)/);

    const configGuardIndex = webhookSource.indexOf('if (!operatorSmsConfigValid)');
    const lookupIndex = webhookSource.indexOf('const { data: orderForSms');
    expect(configGuardIndex).toBeGreaterThanOrEqual(0);
    expect(lookupIndex).toBeGreaterThan(configGuardIndex);

    const lookup = sourceBetween(webhookSource, 'const { data: orderForSms', 'if (smsLookupError)');
    const claim = sourceBetween(webhookSource, 'async function claimOperatorSms', 'async function releaseOperatorSms');
    const release = sourceBetween(webhookSource, 'async function releaseOperatorSms', 'async function sendOperatorSms');
    expect(lookup).toContain(".eq('provider_id', defaultProviderOwnerUserId)");
    expect(claim).toContain(".eq('provider_id', providerOwnerUserId)");
    expect(claim).toContain(".is('operator_sms_sent_at', null)");
    expect(release).toContain(".eq('provider_id', providerOwnerUserId)");
    expect(release).toContain(".eq('operator_sms_sent_at', claimToken)");
    expect(release).toContain("throw new Error('operator SMS release matched no retained claim')");
  });

  it('uses only explicit send-sms rejection evidence to release a claim', () => {
    expect(notificationSource).not.toMatch(/confirmation_email_sent_at|orderForEmail/);
    expect(notificationSource).toContain("outcome === 'mock' || outcome === 'rate_limited' || outcome === 'not_sent'");
    expect(notificationSource).toContain("return { status: 'uncertain', reason: 'ambiguous_response' }");
    expect(notificationSource).toContain("return { status: 'uncertain', reason: 'release' }");
    expect(notificationSource).toContain("json.mock === true");
    expect(notificationSource).toContain("httpStatus === 429");
    expect(notificationSource).toContain("/^Twilio error: [345][0-9]{2}$/");
    expect(notificationSource).not.toMatch(/Failed to reach Twilio[\s\S]*return 'not_sent'/);
  });

  it('keeps transport ambiguity, secrets, and recipient data out of webhook logs', () => {
    expect(webhookSource).toContain('AbortSignal.timeout(10_000)');
    expect(webhookSource).toContain("return 'ambiguous'");
    expect(webhookSource).not.toMatch(/console\.(?:log|warn|error)\([^\n]*(?:orderNotifyPhoneE164|serviceRoleKey|body|setupIntent\.metadata)/);
    expect(webhookSource).not.toMatch(/['"]\+[1-9]\d{7,14}['"]/);
  });
});
