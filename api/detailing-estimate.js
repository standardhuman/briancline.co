import { Resend } from 'resend';
import { emailLayout, detailRow, sectionHeading } from './_email-layout.js';
import { requireResendSuccess } from './_resend-result.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, phone, marina, dockSlip, boatName, boatLength, services, notes,
    anythingElse, boatType, beam, estimateTotal, estimateLineItems } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const servicesList = services || 'None specified';

  try {
    const body = `
      <div style="padding:16px;background:linear-gradient(135deg,#1565c0,#0097a7);border-radius:10px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#b2ebf2;">Detailing Estimate</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${name}${boatName ? ` — ${boatName}` : ''}</p>
      </div>

      ${sectionHeading('Contact')}
      <table style="width:100%;border-collapse:collapse;">
        ${detailRow('Name', name, true)}
        ${detailRow('Email', `<a href="mailto:${email}" style="color:#1565c0;text-decoration:none;">${email}</a>`)}
        ${phone ? detailRow('Phone', phone, true) : ''}
      </table>

      ${sectionHeading('Vessel')}
      <table style="width:100%;border-collapse:collapse;">
        ${boatName ? detailRow('Boat Name', boatName, true) : ''}
        ${boatLength ? detailRow('Length', `${boatLength} ft`) : ''}
        ${beam ? detailRow('Beam', `${beam} ft`, true) : ''}
        ${boatType ? detailRow('Type', boatType === 'sail' ? 'Sailboat' : 'Powerboat') : ''}
        ${marina ? detailRow('Marina', marina, true) : ''}
        ${dockSlip ? detailRow('Dock / Slip', dockSlip) : ''}
      </table>

      ${sectionHeading('Services Requested')}
      <p style="font-size:14px;color:#334155;margin:0 0 12px;">${servicesList}</p>

      ${estimateTotal ? `
      <div style="padding:14px 16px;background:linear-gradient(135deg,#e0f2fe,#e0f7fa);border-radius:8px;margin:16px 0;">
        <p style="margin:0;font-size:16px;font-weight:600;color:#0e7490;">Calculator Estimate: $${estimateTotal}</p>
        ${estimateLineItems ? `<p style="margin:6px 0 0;font-size:13px;color:#155e75;">${estimateLineItems}</p>` : ''}
      </div>` : ''}

      ${anythingElse ? `
      ${sectionHeading('Additional Services Requested')}
      <p style="font-size:14px;color:#334155;margin:0;">${anythingElse.replace(/\n/g, '<br>')}</p>` : ''}

      ${notes ? `
      ${sectionHeading('Notes')}
      <div style="padding:14px 16px;background-color:#f8fafc;border-left:3px solid #0097a7;border-radius:4px;">
        <p style="margin:0;font-size:14px;white-space:pre-wrap;color:#334155;">${notes.replace(/\n/g, '<br>')}</p>
      </div>` : ''}
    `;

    const textContent = [
      `Detailing Estimate Request`,
      ``,
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      marina ? `Marina: ${marina}` : null,
      dockSlip ? `Dock/Slip: ${dockSlip}` : null,
      boatName ? `Boat: ${boatName}` : null,
      boatLength ? `Length: ${boatLength} ft` : null,
      beam ? `Beam: ${beam} ft` : null,
      boatType ? `Type: ${boatType}` : null,
      ``,
      `Services: ${servicesList}`,
      estimateTotal ? `\nCalculator Estimate: $${estimateTotal}` : null,
      estimateLineItems ? `Breakdown: ${estimateLineItems}` : null,
      anythingElse ? `\nAdditional Services Requested:\n${anythingElse}` : null,
      notes ? `\nNotes:\n${notes}` : null,
    ].filter(Boolean).join('\n');

    requireResendSuccess(await resend.emails.send({
      from: 'Brian Cline <detailing@briancline.co>',
      to: 'standardhuman@gmail.com',
      replyTo: email,
      subject: `Detailing Estimate — ${name}${boatName ? ` (${boatName})` : ''}${estimateTotal ? ` — $${estimateTotal}` : ''}`,
      text: textContent,
      html: emailLayout('Detailing Estimate Request', body),
    }));

    return res.status(200).json({ success: true });
  } catch (error) {
    const providerErrorName = /^Resend send failed: ([A-Za-z0-9_-]+)$/.exec(error?.message ?? '')?.[1] ?? 'unknown';
    console.error({ requestId: req.headers?.['x-request-id'] ?? 'unknown', endpoint: '/api/detailing-estimate', providerErrorName });
    return res.status(500).json({ error: 'Failed to send message' });
  }
}
