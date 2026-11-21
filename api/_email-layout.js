// Shared email layout matching briancline.co website branding

export function emailLayout(title, body) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:32px 0;text-align:center;background:linear-gradient(135deg,#1565c0,#0097a7);border-radius:12px 12px 0 0;">
        <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">briancline<span style="color:#00bcd4;">.</span>co</p>
        <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#b2ebf2;">marine</p>
      </td>
    </tr>
    <tr>
      <td style="padding:36px 32px;background-color:#ffffff;">
        ${body}
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;background-color:#1a2332;border-radius:0 0 12px 12px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">
          <a href="https://briancline.co" style="color:#4dd0e1;text-decoration:none;">briancline.co</a>
          &nbsp;&middot;&nbsp;
          <a href="mailto:brian@briancline.co" style="color:#4dd0e1;text-decoration:none;">brian@briancline.co</a>
        </p>
        <p style="margin:0;font-size:12px;color:#64748b;">&copy; ${year} Brian Cline. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function detailRow(label, value, alt = false) {
  return `<tr style="${alt ? 'background-color:#f8fafc;' : ''}">
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:38%;">${label}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;">${value}</td>
  </tr>`;
}

export function sectionHeading(text) {
  return `<h2 style="font-size:15px;font-weight:600;color:#1565c0;margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">${text}</h2>`;
}
