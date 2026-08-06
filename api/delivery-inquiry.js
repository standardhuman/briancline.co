import { Resend } from 'resend';
import { emailLayout, detailRow, sectionHeading } from './_email-layout.js';
import { requireResendSuccess } from './_resend-result.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    name, email, phone,
    vesselMake, vesselModel, vesselLength, vesselYear, vesselCondition,
    currentMarina, currentCity,
    destMarina, destCity,
    schedule, deadline,
    notes,
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const vesselDesc = [vesselYear, vesselMake, vesselModel, vesselLength ? `${vesselLength}ft` : '']
    .filter(Boolean).join(' ') || 'Not specified';

  try {
    const body = `
      <div style="padding:16px;background:linear-gradient(135deg,#1565c0,#0097a7);border-radius:10px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#b2ebf2;">Delivery Inquiry</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${name} — ${vesselDesc}</p>
      </div>

      ${sectionHeading('Contact')}
      <table style="width:100%;border-collapse:collapse;">
        ${detailRow('Name', name, true)}
        ${detailRow('Email', `<a href="mailto:${email}" style="color:#1565c0;text-decoration:none;">${email}</a>`)}
        ${phone ? detailRow('Phone', `<a href="tel:${phone}" style="color:#1565c0;text-decoration:none;">${phone}</a>`, true) : ''}
      </table>

      ${sectionHeading('Vessel')}
      <table style="width:100%;border-collapse:collapse;">
        ${vesselMake ? detailRow('Make', vesselMake, true) : ''}
        ${vesselModel ? detailRow('Model', vesselModel) : ''}
        ${vesselLength ? detailRow('Length', `${vesselLength} ft`, true) : ''}
        ${vesselYear ? detailRow('Year', vesselYear) : ''}
        ${vesselCondition ? detailRow('Condition', vesselCondition, true) : ''}
      </table>

      ${sectionHeading('Route')}
      <table style="width:100%;border-collapse:collapse;">
        ${detailRow('From', `${currentMarina || '—'}, ${currentCity || '—'}`, true)}
        ${detailRow('To', `${destMarina || '—'}, ${destCity || '—'}`)}
      </table>

      ${sectionHeading('Schedule')}
      <table style="width:100%;border-collapse:collapse;">
        ${schedule ? detailRow('When', schedule, true) : ''}
        ${deadline ? detailRow('Deadline', deadline) : ''}
      </table>

      ${notes ? `
      ${sectionHeading('Notes')}
      <div style="padding:14px 16px;background-color:#f8fafc;border-left:3px solid #0097a7;border-radius:4px;">
        <p style="margin:0;font-size:14px;white-space:pre-wrap;color:#334155;">${notes.replace(/\n/g, '<br>')}</p>
      </div>` : ''}
    `;

    const textContent = [
      `Vessel Delivery Inquiry`,
      ``,
      `Contact:`,
      `  Name: ${name}`,
      `  Email: ${email}`,
      phone ? `  Phone: ${phone}` : null,
      ``,
      `Vessel:`,
      vesselMake ? `  Make: ${vesselMake}` : null,
      vesselModel ? `  Model: ${vesselModel}` : null,
      vesselLength ? `  Length: ${vesselLength} ft` : null,
      vesselYear ? `  Year: ${vesselYear}` : null,
      vesselCondition ? `  Condition: ${vesselCondition}` : null,
      ``,
      `Route:`,
      `  From: ${currentMarina || '?'}, ${currentCity || '?'}`,
      `  To: ${destMarina || '?'}, ${destCity || '?'}`,
      ``,
      `Schedule:`,
      schedule ? `  When: ${schedule}` : null,
      deadline ? `  Deadline: ${deadline}` : null,
      notes ? `\nNotes:\n${notes}` : null,
    ].filter(Boolean).join('\n');

    requireResendSuccess(await resend.emails.send({
      from: 'Brian Cline <deliveries@briancline.co>',
      to: 'standardhuman@gmail.com',
      replyTo: email,
      subject: `Delivery Inquiry — ${name} — ${vesselDesc}`,
      text: textContent,
      html: emailLayout('Vessel Delivery Inquiry', body),
    }));

    return res.status(200).json({ success: true });
  } catch (error) {
    const providerErrorName = /^Resend send failed: ([A-Za-z0-9_-]+)$/.exec(error?.message ?? '')?.[1] ?? 'unknown';
    console.error({ requestId: req.headers?.['x-request-id'] ?? 'unknown', endpoint: '/api/delivery-inquiry', providerErrorName });
    return res.status(500).json({ error: 'Failed to send message' });
  }
}
