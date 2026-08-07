import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { captureException, sendEmail } = vi.hoisted(() => ({
  captureException: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendEmail };
  },
}));

vi.mock('../api/_monitoring.js', () => ({
  createServerMonitoring: vi.fn(() => ({ captureException })),
}));

import contactHandler from '../api/contact.js';
import deliveryInquiryHandler from '../api/delivery-inquiry.js';
import detailingEstimateHandler from '../api/detailing-estimate.js';

function createResponse(order) {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  response.json.mockImplementation((body) => {
    order.push('response');
    return body;
  });
  return response;
}

const endpoints = [
  {
    name: 'contact',
    handler: contactHandler,
    body: { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Hello' },
    errorBody: { error: 'Failed to send message' },
  },
  {
    name: 'delivery-inquiry',
    handler: deliveryInquiryHandler,
    body: { name: 'Ada Lovelace', email: 'ada@example.com' },
    errorBody: { error: 'Failed to send message' },
  },
  {
    name: 'detailing-estimate',
    handler: detailingEstimateHandler,
    body: { name: 'Ada Lovelace', email: 'ada@example.com' },
    errorBody: { error: 'Failed to send message' },
  },
];

describe('public email API monitoring integration', () => {
  beforeEach(() => {
    sendEmail.mockReset();
    captureException.mockReset();
    sendEmail.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'private provider detail' },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe.each(endpoints)('$name', ({ name, handler, body, errorBody }) => {
    it('captures the failure before returning the existing generic 500 response', async () => {
      const order = [];
      let finishCapture;
      captureException.mockImplementation(() => new Promise((resolve) => {
        order.push('capture');
        finishCapture = () => resolve(true);
      }));
      const response = createResponse(order);

      const handlerPromise = handler(
        { method: 'POST', body, headers: { 'x-request-id': 'request_123' } },
        response,
      );

      await vi.waitFor(() => expect(captureException).toHaveBeenCalledOnce());

      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Resend send failed: validation_error' }),
        { surface: 'email-api', endpoint: name, stage: 'resend-send' },
      );
      expect(response.status).not.toHaveBeenCalled();

      finishCapture();
      await handlerPromise;

      expect(order).toStrictEqual(['capture', 'response']);
      expect(response.status).toHaveBeenCalledOnce();
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(errorBody);
    });

    it('preserves the existing generic 500 response when monitoring rejects', async () => {
      captureException.mockRejectedValueOnce(new Error('monitoring unavailable'));
      const response = createResponse([]);

      await expect(handler(
        { method: 'POST', body, headers: { 'x-request-id': 'request_123' } },
        response,
      )).resolves.toBeDefined();

      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(errorBody);
    });

    it('replaces a malicious request ID before writing the allowlisted failure log', async () => {
      captureException.mockResolvedValueOnce(true);
      const response = createResponse([]);

      await handler(
        { method: 'POST', body, headers: { 'x-request-id': 'ada@example.com\nforged-log-entry' } },
        response,
      );

      expect(console.error).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalledWith({
        requestId: 'unknown',
        endpoint: `/api/${name}`,
        providerErrorName: 'validation_error',
      });
    });
  });
});
