import { describe, expect, it } from 'vitest';
import { requireResendSuccess } from '../api/_resend-result.js';

describe('requireResendSuccess', () => {
  it('returns the message ID from a successful Resend response', () => {
    expect(requireResendSuccess({ data: { id: 'email_123' } })).toBe('email_123');
  });

  it('reports only the provider error name without leaking the SDK payload', () => {
    const recipient = 'customer@example.com';
    const messageBody = 'Private customer message';
    const payload = 'resend-request-opaque-payload';

    let thrown;

    try {
      requireResendSuccess({
        error: {
          name: 'validation_error',
          message: `Unable to send to ${recipient}: ${messageBody}`,
          recipient,
          payload,
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown.message).toBe('Resend send failed: validation_error');
    expect(thrown.message).not.toContain(recipient);
    expect(thrown.message).not.toContain(messageBody);
    expect(thrown.message).not.toContain(payload);
  });

  it('fails closed when the response has no data', () => {
    expect(() => requireResendSuccess({})).toThrow('Resend send failed: missing message id');
  });

  it('fails closed when the response data has no message ID', () => {
    expect(() => requireResendSuccess({ data: {} })).toThrow('Resend send failed: missing message id');
  });
});
