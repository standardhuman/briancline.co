import { beforeEach, describe, expect, it, vi } from 'vitest';
import { escapeHtml } from '../api/_escape-html.js';

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
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

const hostile = '<script>alert("x")</script><a href="https://evil.test" onerror="boom">x</a>&\'';
const email = "o'hara@example.com";

const endpoints = [
  {
    name: 'contact',
    handler: contactHandler,
    body: { name: hostile, email, message: `${hostile}\nsecond line` },
  },
  {
    name: 'delivery inquiry',
    handler: deliveryInquiryHandler,
    body: {
      name: hostile,
      email,
      phone: hostile,
      vesselMake: hostile,
      vesselModel: hostile,
      vesselLength: hostile,
      vesselYear: hostile,
      vesselCondition: hostile,
      currentMarina: hostile,
      currentCity: hostile,
      destMarina: hostile,
      destCity: hostile,
      schedule: hostile,
      deadline: hostile,
      notes: `${hostile}\nsecond line`,
    },
  },
  {
    name: 'detailing estimate',
    handler: detailingEstimateHandler,
    body: {
      name: hostile,
      email,
      phone: hostile,
      marina: hostile,
      dockSlip: hostile,
      boatName: hostile,
      boatLength: hostile,
      services: hostile,
      notes: `${hostile}\nsecond line`,
      anythingElse: `${hostile}\nsecond line`,
      boatType: 'sail',
      beam: hostile,
      estimateTotal: hostile,
      estimateLineItems: hostile,
    },
  },
];

describe('escapeHtml', () => {
  it('escapes HTML-significant characters while preserving newlines', () => {
    expect(escapeHtml('&<>"\'first\nsecond')).toBe('&amp;&lt;&gt;&quot;&#39;first\nsecond');
  });
});

describe('public email HTML', () => {
  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue({ data: { id: 'email_123' }, error: null });
  });

  describe.each(endpoints)('$name', ({ handler, body }) => {
    it('escapes customer-controlled HTML at the Resend boundary', async () => {
      const response = createResponse();

      await handler({ method: 'POST', body, headers: { 'x-request-id': 'request_123' } }, response);

      const [payload] = sendEmail.mock.calls[0];

      expect(response.status).toHaveBeenCalledWith(200);
      expect(payload.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
      expect(payload.html).not.toContain('<script');
      expect(payload.html).not.toContain('onerror="boom"');
      expect(payload.html).not.toContain('<a href="https://evil.test"');
      expect(payload.replyTo).toBe(email);
      expect(payload.to).toBe('standardhuman@gmail.com');
    });
  });
});
