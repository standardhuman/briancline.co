import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendEmail };
  },
}));

import contactHandler from '../api/contact.js';
import deliveryInquiryHandler from '../api/delivery-inquiry.js';
import detailingEstimateHandler from '../api/detailing-estimate.js';

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response;
}

const endpoints = [
  {
    name: 'contact',
    handler: contactHandler,
    body: { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Please get in touch.' },
  },
  {
    name: 'delivery inquiry',
    handler: deliveryInquiryHandler,
    body: { name: 'Ada Lovelace', email: 'ada@example.com' },
  },
  {
    name: 'detailing estimate',
    handler: detailingEstimateHandler,
    body: { name: 'Ada Lovelace', email: 'ada@example.com' },
  },
];

describe('public email API provider results', () => {
  beforeEach(() => {
    sendEmail.mockReset();
  });

  describe.each(endpoints)('$name', ({ handler, body }) => {
    it('preserves its success response after Resend accepts the email', async () => {
      sendEmail.mockResolvedValue({ data: { id: 'email_123' }, error: null });
      const response = createResponse();

      await handler({ method: 'POST', body, headers: { 'x-request-id': 'request_123' } }, response);

      expect(response.status).toHaveBeenCalledOnce();
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({ success: true });
    });

    it('returns a generic server error when Resend returns an error result', async () => {
      sendEmail.mockResolvedValue({
        data: null,
        error: {
          name: 'validation_error',
          message: 'Recipient is invalid: ada@example.com',
        },
      });
      const response = createResponse();

      await handler({ method: 'POST', body, headers: { 'x-request-id': 'request_123' } }, response);

      expect(response.status).toHaveBeenCalledOnce();
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({ error: 'Failed to send message' });
    });
  });
});
