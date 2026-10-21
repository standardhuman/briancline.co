// Notifications for a pay-by-invoice order.
//
// Card orders are announced by diving-stripe-webhook on setup_intent.succeeded.
// An invoice order creates no SetupIntent, so that webhook never fires for it;
// create-payment-intent calls sendInvoiceOrderNotifications() right after the
// order is recorded instead. Same guarantees as the webhook path:
//   * idempotent: the emails go out only after an atomic claim on
//     service_orders.confirmation_email_sent_at, and the operator SMS goes
//     through notifyOperatorForSuccessfulOrder (claim on operator_sms_sent_at);
//   * independent: an email failure releases its claim and never blocks the SMS;
// and one extra guarantee the request path needs: this function NEVER throws.
// The order already exists when it runs, so a notification failure must not
// turn into an error the customer sees.

import {
  notifyOperatorForSuccessfulOrder,
  type OperatorOrderSmsInput,
  type OperatorSmsDeps,
  type OperatorSmsResult,
} from './new-order-notification.ts'
import {
  formatCheckoutQuoteForEmail,
  readStoredCheckoutQuote,
  type FormattedCheckoutQuote,
} from './stored-checkout-quote.ts'
import { INVOICE_TERMS_TEXT } from './invoice-terms.ts'
import { readSchedulingRequest, renderSchedulingRequestAdminSection } from './order-scheduling.ts'

export const PRO_REVIEW_URL = 'https://pro.sailorskills.com/admin/v2/orders?filter=review'

/** The service_orders row (with joins) the emails are rendered from. */
export interface InvoiceOrderEmailRow {
  order_number: string
  service_type: string | null
  service_interval: string | null
  estimate_mode: string | null
  estimated_amount: number | string | null
  estimated_min_amount: number | string | null
  estimated_max_amount: number | string | null
  notes: string | null
  service_details: Record<string, any> | null
  dock: string | null
  slip_number: string | null
  requires_review: boolean | null
  boat: { name?: string | null; length?: number | string | null; make?: string | null; model?: string | null } | null
  marina: { name?: string | null } | null
  customer: { name?: string | null; email?: string | null; phone?: string | null } | null
}

export interface EmailMessage {
  to: string
  subject: string
  html: string
}

export interface InvoiceNotificationDeps {
  /**
   * Atomically stamp confirmation_email_sent_at (only while it is NULL) and
   * return the order for rendering. Returns null when the stamp was already
   * taken, meaning the emails were already sent (or are being sent).
   */
  claimEmail(orderId: string): Promise<InvoiceOrderEmailRow | null>
  /** Clear the stamp after a failed send so the order shows as not emailed. */
  releaseEmail(orderId: string): Promise<void>
  /** Send one email. Must throw (or reject) when the provider did not accept it. */
  sendEmail(message: EmailMessage): Promise<void>
  adminEmail: string
  /** The lead's own marina check also flagged this order (independent of invoice). */
  marinaNeedsReview: boolean
  /** Operator SMS wiring, or null when the SMS configuration is missing/invalid. */
  sms: { input: OperatorOrderSmsInput; deps: OperatorSmsDeps } | null
  warn(message: string, context: Record<string, unknown>): void
}

export type InvoiceEmailOutcome =
  | 'sent'
  | 'duplicate'
  | 'no_customer_email'
  | 'claim_failed'
  | 'send_failed'

export interface InvoiceNotificationResult {
  email: InvoiceEmailOutcome
  sms: OperatorSmsResult | { status: 'skipped'; reason: 'not_configured' } | { status: 'uncertain'; reason: 'unexpected' }
}

export async function sendInvoiceOrderNotifications(
  orderId: string,
  deps: InvoiceNotificationDeps,
): Promise<InvoiceNotificationResult> {
  const email = await sendInvoiceOrderEmails(orderId, deps)

  let sms: InvoiceNotificationResult['sms']
  if (!deps.sms) {
    safeWarn(deps, 'Operator SMS configuration is missing or invalid', { orderId })
    sms = { status: 'skipped', reason: 'not_configured' }
  } else {
    try {
      sms = await notifyOperatorForSuccessfulOrder(deps.sms.input, deps.sms.deps)
    } catch (error) {
      safeWarn(deps, 'Operator SMS notification failed with a retained outcome', {
        orderId,
        errorClass: errorClass(error),
      })
      sms = { status: 'uncertain', reason: 'unexpected' }
    }
  }

  return { email, sms }
}

async function sendInvoiceOrderEmails(
  orderId: string,
  deps: InvoiceNotificationDeps,
): Promise<InvoiceEmailOutcome> {
  let order: InvoiceOrderEmailRow | null
  try {
    order = await deps.claimEmail(orderId)
  } catch (error) {
    safeWarn(deps, '[invoice-order-email-failed] confirmation email claim failed', {
      orderId,
      errorClass: errorClass(error),
    })
    return 'claim_failed'
  }
  if (!order) return 'duplicate'

  const customerEmail = order.customer?.email?.trim()
  if (!customerEmail) {
    safeWarn(deps, 'Invoice order has no customer email; confirmation emails skipped', { orderId })
    return 'no_customer_email'
  }

  try {
    const customerMessage = buildInvoiceCustomerEmail(order)
    await deps.sendEmail({ to: customerEmail, ...customerMessage })
    const adminMessage = buildInvoiceAdminEmail(order, { marinaNeedsReview: deps.marinaNeedsReview })
    await deps.sendEmail({ to: deps.adminEmail, ...adminMessage })
    return 'sent'
  } catch (error) {
    // Same rule as the webhook: the stamp was claimed BEFORE sending, so a failed
    // send must release it or the order reads as emailed when it was not.
    safeWarn(deps, '[invoice-order-email-failed] confirmation email send failed; claim released', {
      orderId,
      errorClass: errorClass(error),
    })
    try {
      await deps.releaseEmail(orderId)
    } catch (releaseError) {
      safeWarn(deps, '[invoice-order-email-failed] confirmation email claim release failed', {
        orderId,
        errorClass: errorClass(releaseError),
      })
    }
    return 'send_failed'
  }
}

// ── Email content ──

export function buildInvoiceCustomerEmail(order: InvoiceOrderEmailRow): { subject: string; html: string } {
  const quote = quoteFor(order)
  const name = escapeHtml(order.customer?.name || 'there')
  const termsList = INVOICE_TERMS_TEXT
    .map((line) => `<li style="margin:0 0 6px;">${escapeHtml(line)}</li>`)
    .join('')
  const body = `<h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#1e293b;text-align:center;">Order Received</h1>`
    + `<p style="font-size:16px;color:#334155;margin:0 0 16px;">Hi ${name},</p>`
    + `<p style="font-size:15px;color:#475569;margin:0 0 24px;">Thanks for your order. You asked to pay by invoice, so we'll review your request and confirm by email before your first service. No card was saved.</p>`
    + `<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">`
    + detailRow('Order Number', `<span style="font-family:monospace;font-weight:600;">${escapeHtml(order.order_number)}</span>`, true)
    + detailRow('Service', escapeHtml(order.service_type || 'Service'))
    + detailRow('Frequency', formatServiceInterval(order.service_interval), true)
    + (quote ? detailRow(quote.label, quote.value) : '')
    + detailRow('Payment', 'Pay by invoice (pending review)', true)
    + `</table>`
    + `<div style="padding:14px 16px;background-color:#f0f9ff;border-left:3px solid #0097a7;border-radius:4px;margin-bottom:24px;">`
    + `<p style="margin:0 0 8px;font-size:14px;color:#0e7490;"><strong>Pay-by-invoice terms</strong></p>`
    + `<ul style="margin:0;padding-left:18px;font-size:13px;color:#155e75;">${termsList}</ul>`
    + `</div>`
    + `<p style="font-size:14px;color:#64748b;margin:0;">Questions? Reach me at <a href="mailto:diving@briancline.co" style="color:#1565c0;text-decoration:none;">diving@briancline.co</a></p>`
  return {
    subject: `Order received: ${order.order_number}`,
    html: emailLayout('Order Received', body),
  }
}

export function buildInvoiceAdminEmail(
  order: InvoiceOrderEmailRow,
  options: { marinaNeedsReview?: boolean } = {},
): { subject: string; html: string } {
  const quote = quoteFor(order)
  const customer = order.customer || {}
  const boat = order.boat || {}
  const breakdown = order.service_details?.breakdown as
    | { items?: Array<{ amount: number; description: string }>; total?: number }
    | null
    | undefined
  const marinaNote = options.marinaNeedsReview
    ? `<p style="margin:8px 0 0;font-size:14px;color:#92400e;">The marina is also not on the standard list. Verify it before scheduling.</p>`
    : ''
  const banner = `<div style="margin-bottom:20px;padding:14px 16px;background-color:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;">`
    + `<p style="margin:0;font-size:14px;color:#92400e;"><strong>Pay by invoice requested, approve in Pro.</strong> No card was saved. This order is held for review and no recurring schedule was created.</p>`
    + marinaNote
    + `<p style="margin:8px 0 0;font-size:14px;"><a href="${PRO_REVIEW_URL}" style="color:#1565c0;">Open the review queue</a></p>`
    + `</div>`

  const breakdownSection = breakdown?.items?.length
    ? sectionHeading('Price Breakdown')
      + `<table style="width:100%;border-collapse:collapse;">`
      + breakdown.items.map((item, index) =>
        detailRow(escapeHtml(item.description), '$' + Number(item.amount).toFixed(2), index % 2 === 0)).join('')
      + (typeof breakdown.total === 'number' ? detailRow('Total', '$' + breakdown.total.toFixed(2)) : '')
      + `</table>`
    : ''

  const body = banner
    + `<p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">New Order</p>`
    + `<p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;">${escapeHtml(order.order_number)}</p>`
    + sectionHeading('Order Details')
    + `<table style="width:100%;border-collapse:collapse;">`
    + detailRow('Service', escapeHtml(order.service_type || 'Service'), true)
    + (quote ? detailRow(quote.label, `<span style="font-weight:600;color:#059669;">${quote.value}</span>`) : '')
    + detailRow('Payment', 'Pay by invoice requested (no card on file)', true)
    + detailRow('Frequency', formatServiceInterval(order.service_interval))
    + `</table>`
    + sectionHeading('Customer')
    + `<table style="width:100%;border-collapse:collapse;">`
    + detailRow('Name', escapeHtml(customer.name || 'N/A'), true)
    + detailRow('Email', escapeHtml(customer.email || 'N/A'))
    + detailRow('Phone', escapeHtml(customer.phone || 'N/A'), true)
    + `</table>`
    + sectionHeading('Boat and Location')
    + `<table style="width:100%;border-collapse:collapse;">`
    + detailRow('Boat', escapeHtml(boat.name || 'N/A'), true)
    + detailRow('Length', boat.length ? `${escapeHtml(String(boat.length))} ft` : 'N/A')
    + detailRow('Make / Model', escapeHtml([boat.make, boat.model].filter(Boolean).join(' ') || 'N/A'), true)
    + detailRow('Marina', escapeHtml(order.marina?.name || 'N/A'))
    + detailRow('Dock / Slip', escapeHtml([order.dock, order.slip_number].filter(Boolean).join(' / ') || 'N/A'), true)
    + `</table>`
    + breakdownSection
    + renderSchedulingRequestAdminSection(readSchedulingRequest(order.service_details), sectionHeading)
    + (order.notes
      ? sectionHeading('Customer Notes')
        + `<p style="margin:0;font-size:14px;white-space:pre-wrap;color:#334155;">${escapeHtml(order.notes)}</p>`
      : '')
  return {
    subject: `New Order: ${order.order_number} - ${order.service_type || 'Service'} (PAY BY INVOICE, REVIEW)`,
    html: emailLayout(`New Order ${order.order_number}`, body),
  }
}

function quoteFor(order: InvoiceOrderEmailRow): FormattedCheckoutQuote | null {
  const quote = readStoredCheckoutQuote(order as unknown as Record<string, unknown>)
  return quote ? formatCheckoutQuoteForEmail(quote) : null
}

function formatServiceInterval(interval: string | null): string {
  const intervalMap: Record<string, string> = {
    'one-time': 'One-time service', one_time: 'One-time service',
    monthly: 'Monthly', bimonthly: 'Every 2 months', quarterly: 'Every 3 months', biannual: 'Every 6 months',
    '1': 'Monthly', '2': 'Every 2 months', '3': 'Every 3 months', '6': 'Every 6 months',
  }
  return (interval && intervalMap[interval]) || 'One-time service'
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function emailLayout(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;"><tr><td style="padding:32px 0;text-align:center;background:linear-gradient(135deg,#1565c0,#0097a7);border-radius:12px 12px 0 0;"><p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">briancline<span style="color:#4dd0e1;">.</span>co</p><p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#b2ebf2;">marine</p></td></tr><tr><td style="padding:36px 32px;background-color:#ffffff;">${body}</td></tr><tr><td style="padding:24px 32px;background-color:#1a2332;border-radius:0 0 12px 12px;text-align:center;"><p style="margin:0;font-size:13px;color:#94a3b8;"><a href="https://briancline.co" style="color:#4dd0e1;text-decoration:none;">briancline.co</a>&nbsp;&middot;&nbsp;<a href="mailto:diving@briancline.co" style="color:#4dd0e1;text-decoration:none;">diving@briancline.co</a></p></td></tr></table></body></html>`
}

function detailRow(label: string, value: string, alt = false): string {
  return `<tr style="${alt ? 'background-color:#f8fafc;' : ''}"><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:38%;">${label}</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;">${value}</td></tr>`
}

function sectionHeading(text: string): string {
  return `<h2 style="font-size:15px;font-weight:600;color:#1565c0;margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">${text}</h2>`
}

function errorClass(error: unknown): string {
  return error instanceof Error ? error.constructor.name : typeof error
}

function safeWarn(
  deps: Pick<InvoiceNotificationDeps, 'warn'>,
  message: string,
  context: Record<string, unknown>,
): void {
  try {
    deps.warn(message, context)
  } catch {
    // Warning telemetry must never affect order creation.
  }
}
