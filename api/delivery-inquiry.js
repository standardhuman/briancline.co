import { Resend } from 'resend';
import * as Sentry from '@sentry/node';
import { escapeHtml } from './_escape-html.js';
import { emailLayout, detailRow, sectionHeading } from './_email-layout.js';
import { createServerMonitoring } from './_monitoring.js';
import { sanitizeRequestId } from './_request-id.js';
import { requireResendSuccess } from './_resend-result.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const monitoring = createServerMonitoring({ sdk: Sentry, env: process.env });

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
  const html = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    phone: escapeHtml(phone),
    vesselMake: escapeHtml(vesselMake),
    vesselModel: escapeHtml(vesselModel),
    vesselLength: escapeHtml(vesselLength),
    vesselYear: escapeHtml(vesselYear),
    vesselCondition: escapeHtml(vesselCondition),
    currentMarina: escapeHtml(currentMarina),
    currentCity: escapeHtml(currentCity),
    destMarina: escapeHtml(destMarina),
    destCity: escapeHtml(destCity),
    schedule: escapeHtml(schedule),
    deadline: escapeHtml(deadline),
    notes: escapeHtml(notes).replace(/\n/g, '<br>'),
    vesselDesc: escapeHtml(vesselDesc),
  };

  try {
    const body = `
      <div style="padding:16px;background:linear-gradient(135deg,#1565c0,#0097a7);border-radius:10px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#b2ebf2;">Delivery Inquiry</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${html.name} — ${html.vesselDesc}</p>
      </div>

      ${sectionHeading('Contact')}
      <table style="width:100%;border-collapse:collapse;">
        ${detailRow('Name', html.name, true)}
        ${detailRow('Email', `<a href="mailto:${html.email}" style="color:#1565c0;text-decoration:none;">${html.email}</a>`)}
        ${phone ? detailRow('Phone', `<a href="tel:${html.phone}" style="color:#1565c0;text-decoration:none;">${html.phone}</a>`, true) : ''}
      </table>

      ${sectionHeading('Vessel')}
      <table style="width:100%;border-collapse:collapse;">
        ${vesselMake ? detailRow('Make', html.vesselMake, true) : ''}
        ${vesselModel ? detailRow('Model', html.vesselModel) : ''}
        ${vesselLength ? detailRow('Length', `${html.vesselLength} ft`, true) : ''}
        ${vesselYear ? detailRow('Year', html.vesselYear) : ''}
        ${vesselCondition ? detailRow('Condition', html.vesselCondition, true) : ''}
      </table>

      ${sectionHeading('Route')}
      <table style="width:100%;border-collapse:collapse;">
        ${detailRow('From', `${currentMarina ? html.currentMarina : '—'}, ${currentCity ? html.currentCity : '—'}`, true)}
        ${detailRow('To', `${destMarina ? html.destMarina : '—'}, ${destCity ? html.destCity : '—'}`)}
      </table>

      ${sectionHeading('Schedule')}
      <table style="width:100%;border-collapse:collapse;">
        ${schedule ? detailRow('When', html.schedule, true) : ''}
        ${deadline ? detailRow('Deadline', html.deadline) : ''}
      </table>

      ${notes ? `
      ${sectionHeading('Notes')}
      <div style="padding:14px 16px;background-color:#f8fafc;border-left:3px solid #0097a7;border-radius:4px;">
        <p style="margin:0;font-size:14px;white-space:pre-wrap;color:#334155;">${html.notes}</p>
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
    console.error({ requestId: sanitizeRequestId(req.headers?.['x-request-id']), endpoint: '/api/delivery-inquiry', providerErrorName });
    try {
      await monitoring.captureException(error, { surface: 'email-api', endpoint: 'delivery-inquiry', stage: 'resend-send' });
    } catch {
      // Monitoring must never replace the established generic API response.
    }
    return res.status(500).json({ error: 'Failed to send message' });
  }
}
