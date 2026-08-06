import { Resend } from 'resend';
import { emailLayout, detailRow, sectionHeading } from './_email-layout.js';
import { requireResendSuccess } from './_resend-result.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const body = `
      <div style="padding:16px;background:linear-gradient(135deg,#1565c0,#0097a7);border-radius:10px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#b2ebf2;">Contact Form</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">New Message from ${name}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${detailRow('Name', name, true)}
        ${detailRow('Email', `<a href="mailto:${email}" style="color:#1565c0;text-decoration:none;">${email}</a>`)}
      </table>

      ${sectionHeading('Message')}
      <div style="padding:14px 16px;background-color:#f8fafc;border-left:3px solid #0097a7;border-radius:4px;">
        <p style="margin:0;font-size:14px;white-space:pre-wrap;color:#334155;line-height:1.6;">${message.replace(/\n/g, '<br>')}</p>
      </div>
    `;

    requireResendSuccess(await resend.emails.send({
      from: 'Brian Cline <contact@briancline.co>',
      to: 'standardhuman@gmail.com',
      replyTo: email,
      subject: `Contact from ${name} via briancline.co`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: emailLayout(`Contact from ${name}`, body),
    }));

    return res.status(200).json({ success: true });
  } catch (error) {
    const providerErrorName = /^Resend send failed: ([A-Za-z0-9_-]+)$/.exec(error?.message ?? '')?.[1] ?? 'unknown';
    console.error({ requestId: req.headers?.['x-request-id'] ?? 'unknown', endpoint: '/api/contact', providerErrorName });
    return res.status(500).json({ error: 'Failed to send message' });
  }
}
