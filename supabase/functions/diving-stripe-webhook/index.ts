// Stripe webhook handler for briancline.co diving order form.
//
// Listens for setup_intent.succeeded — the moment when stripe.confirmCardSetup
// completes in the customer's browser and the payment method becomes attachable
// for off-session use. We use that to close the audit loop:
//   * insert a payment_methods row with brand + last_four + audit columns
//     populated from the matching order_authorizations row
//   * backfill that order_authorizations row with stripe_payment_method_id
//     and stripe_mandate_id
//   * backfill the service_orders row with stripe_payment_method_id
//   * flip customers.auto_charge_enabled true for recurring orders
//   * send customer + admin confirmation emails (atomic claim on confirmation_email_sent_at)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0?target=deno'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const stripeMode = Deno.env.get('STRIPE_MODE') || 'test'
const stripeSecretKey = stripeMode === 'live'
  ? Deno.env.get('STRIPE_SECRET_KEY_LIVE')
  : Deno.env.get('STRIPE_SECRET_KEY_TEST')
const webhookSecret = stripeMode === 'live'
  ? Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE')
  : Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST')

const stripe = new Stripe(stripeSecretKey ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

// Diving order emails send from diving@briancline.co, whose domain is verified in
// a SEPARATE Resend team from the shared RESEND_API_KEY (that key serves the
// sailorskills.com senders in this project). Use a dedicated key so the two domains
// stay isolated; fall back to the shared key if the dedicated one isn't configured.
const resend = new Resend(
  Deno.env.get('RESEND_API_KEY_DIVING') ?? Deno.env.get('RESEND_API_KEY') ?? '',
)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured for mode:', stripeMode)
    return new Response('Webhook secret not configured', { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', (err as Error).message)
    return new Response('Invalid signature', { status: 400 })
  }

  console.log(`Received webhook: ${event.type} (${event.id})`)

  try {
    switch (event.type) {
      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent)
        break
      default:
        console.log(`Ignoring unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error(`Handler failed for ${event.type}:`, err)
    return new Response(`Handler error: ${(err as Error).message}`, { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})

async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent): Promise<void> {
  const { data: authRow, error: authErr } = await supabase
    .from('order_authorizations')
    .select('id, customer_id, service_order_id, is_recurring, terms_version, recurring_terms_version, authorization_ip, user_agent')
    .eq('stripe_setup_intent_id', setupIntent.id)
    .maybeSingle()

  if (authErr) {
    throw new Error(`Lookup order_authorizations failed: ${authErr.message}`)
  }
  if (!authRow) {
    console.warn(`No order_authorizations row found for setup_intent ${setupIntent.id} — possibly an external SetupIntent. Ignoring.`)
    return
  }

  const paymentMethodId = typeof setupIntent.payment_method === 'string'
    ? setupIntent.payment_method : setupIntent.payment_method?.id
  if (!paymentMethodId) {
    console.warn(`setup_intent ${setupIntent.id} has no payment_method attached. Ignoring.`)
    return
  }

  const customerId = typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id
  if (!customerId) throw new Error(`setup_intent ${setupIntent.id} has no customer ID`)

  const mandateId = typeof (setupIntent as any).mandate === 'string' ? (setupIntent as any).mandate : null

  const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
  const card = pm.card

  const { data: pmRow, error: pmErr } = await supabase
    .from('payment_methods').upsert({
      customer_id: authRow.customer_id, stripe_payment_method_id: paymentMethodId,
      stripe_customer_id: customerId, type: pm.type, brand: card?.brand || null,
      last_four: card?.last4 || null, exp_month: card?.exp_month || null, exp_year: card?.exp_year || null,
      is_default: false, authorized_at: new Date().toISOString(),
      authorization_ip: authRow.authorization_ip, authorization_user_agent: authRow.user_agent,
      terms_version: authRow.terms_version, recurring_terms_version: authRow.recurring_terms_version,
      stripe_mandate_id: mandateId, stripe_setup_intent_id: setupIntent.id,
    }, { onConflict: 'stripe_payment_method_id' }).select('id').single()
  if (pmErr) throw new Error(`Upsert payment_methods failed: ${pmErr.message}`)

  const { data: existingDefaults } = await supabase.from('payment_methods')
    .select('id').eq('customer_id', authRow.customer_id).eq('is_default', true)
    .is('detached_at', null).neq('id', pmRow.id)
  if (!existingDefaults || existingDefaults.length === 0) {
    await supabase.from('payment_methods').update({ is_default: true }).eq('id', pmRow.id)
  }

  await supabase.from('order_authorizations').update({
    stripe_payment_method_id: paymentMethodId, stripe_mandate_id: mandateId, payment_method_id: pmRow.id,
  }).eq('id', authRow.id)

  let orderForEmail: any = null
  if (authRow.service_order_id) {
    const { data, error: orderUpdateErr } = await supabase.from('service_orders').update({
      stripe_payment_method_id: paymentMethodId, confirmation_email_sent_at: new Date().toISOString(),
    }).eq('id', authRow.service_order_id).is('confirmation_email_sent_at', null)
      .select(`order_number, service_type, service_interval, estimated_amount, notes, service_details, dock, slip_number, requires_review,
        boat:boat_id ( name, length, make, model ), marina:marina_id ( name ), customer:customer_id ( name, email, phone )`)
      .maybeSingle()
    if (orderUpdateErr) throw new Error(`service_orders email-claim update failed: ${orderUpdateErr.message}`)
    orderForEmail = data
  }

  if (orderForEmail) {
    try {
      await sendOrderEmails(orderForEmail, card?.brand || null, card?.last4 || null)
    } catch (emailErr: any) {
      // The confirmation_email_sent_at stamp above is an idempotency claim taken
      // BEFORE the send. If the send fails we must release it, otherwise the email
      // is lost forever and never retried (the bug that silently dropped the
      // 2026-06-03 order's emails). Release the claim and rethrow so the top-level
      // handler returns 500 and Stripe redelivers. Every write above this point is
      // idempotent (payment_methods upsert, fixed-value updates), so a full retry
      // is safe.
      console.error('Email send failed; releasing claim for retry:', emailErr?.message, emailErr)
      await supabase.from('service_orders')
        .update({ confirmation_email_sent_at: null })
        .eq('id', authRow.service_order_id)
      throw new Error(`Confirmation email send failed: ${emailErr?.message || emailErr}`)
    }
  } else if (authRow.service_order_id) {
    console.log(`Confirmation email already sent for order ${authRow.service_order_id} (idempotent skip on retry of ${setupIntent.id})`)
  }

  if (authRow.is_recurring) {
    await supabase.from('customers').update({
      auto_charge_enabled: true, auto_charge_enabled_at: new Date().toISOString(),
      auto_charge_disabled_at: null, auto_charge_disabled_reason: null,
    }).eq('id', authRow.customer_id)
  }

  console.log(`setup_intent.succeeded handled for ${setupIntent.id}: customer ${authRow.customer_id}, pm ${paymentMethodId} (${card?.brand} ····${card?.last4}), recurring=${authRow.is_recurring}`)
}

async function sendOrderEmails(order: any, cardBrand: string | null, cardLast4: string | null): Promise<void> {
  const customer = order.customer
  const boat = order.boat
  const marina = order.marina
  if (!customer?.email) {
    console.warn('Order has no customer email; skipping email send', order.order_number)
    return
  }
  const isRecurring = order.service_interval !== 'one-time' && order.service_interval !== 'one_time'
  const fromAddress = Deno.env.get('EMAIL_FROM_ADDRESS') || 'Brian Cline <diving@briancline.co>'
  const adminEmail = Deno.env.get('ADMIN_EMAILS') || 'standardhuman@gmail.com'

  const customerHtml = generateOrderConfirmationEmail(
    order.order_number, customer.name, order.service_type, Number(order.estimated_amount) || 0,
    isRecurring, order.service_interval, cardBrand, cardLast4,
  )
  const customerResult = await resend.emails.send({
    from: fromAddress, to: [customer.email],
    subject: `Order Confirmation - ${order.order_number}`, html: customerHtml,
  })
  console.log(`Customer confirmation sent for ${order.order_number}:`, JSON.stringify(customerResult))

  const adminHtml = generateAdminNotificationEmail(
    order.order_number, customer.name, customer.email, customer.phone || '',
    order.service_type, Number(order.estimated_amount) || 0,
    boat?.name || 'N/A', marina?.name || 'N/A', order.dock || 'N/A', order.slip_number || 'N/A',
    isRecurring, order.notes || '', order.service_interval,
    parseInt(boat?.length) || 0, boat?.make || '', boat?.model || '',
    order.service_details?.boatType || '', order.service_details?.hullType || '',
    order.service_details?.breakdown || null, !!order.requires_review,
  )
  const adminResult = await resend.emails.send({
    from: fromAddress, to: [adminEmail],
    subject: `${order.requires_review ? '⚠️' : '🔔'} New Order: ${order.order_number} - ${order.service_type}${order.requires_review ? ' (REVIEW)' : ''}`,
    html: adminHtml,
  })
  console.log(`Admin notification sent for ${order.order_number}:`, JSON.stringify(adminResult))
}

function emailLayout(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head><body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;"><tr><td style="padding:32px 0;text-align:center;background:linear-gradient(135deg,#1565c0,#0097a7);border-radius:12px 12px 0 0;"><p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">briancline<span style="color:#4dd0e1;">.</span>co</p><p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#b2ebf2;">marine</p></td></tr><tr><td style="padding:36px 32px;background-color:#ffffff;">${body}</td></tr><tr><td style="padding:24px 32px;background-color:#1a2332;border-radius:0 0 12px 12px;text-align:center;"><p style="margin:0 0 8px;font-size:13px;color:#94a3b8;"><a href="https://briancline.co" style="color:#4dd0e1;text-decoration:none;">briancline.co</a>&nbsp;&middot;&nbsp;<a href="mailto:brian@briancline.co" style="color:#4dd0e1;text-decoration:none;">brian@briancline.co</a></p><p style="margin:0;font-size:12px;color:#64748b;">&copy; ${new Date().getFullYear()} Brian Cline. All rights reserved.</p></td></tr></table></body></html>`
}

function detailRow(label: string, value: string, alt = false): string {
  return `<tr style="${alt ? 'background-color:#f8fafc;' : ''}"><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:38%;">${label}</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;">${value}</td></tr>`
}

function sectionHeading(text: string): string {
  return `<h2 style="font-size:15px;font-weight:600;color:#1565c0;margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">${text}</h2>`
}

function generateAdminNotificationEmail(
  orderNumber: string, customerName: string, customerEmail: string, customerPhone: string,
  serviceType: string, estimatedAmount: number, boatName: string, marinaName: string,
  dock: string, slipNumber: string, isRecurring: boolean, customerNotes: string,
  serviceInterval: string, boatLength: number, boatMake: string, boatModel: string,
  boatType: string, hullType: string,
  serviceBreakdown: { items: Array<{ type: string; amount: number; description: string }>; total: number } | null,
  requiresReview: boolean,
): string {
  const reviewBanner = requiresReview
    ? `<div style="margin-bottom:20px;padding:14px 16px;background-color:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;"><p style="margin:0;font-size:14px;color:#991b1b;"><strong>⚠️ Manual review required:</strong> This order's marina is not on the standard whitelist — verify before scheduling. The recurring service schedule has NOT been created.</p></div>` : ''
  const body = `${reviewBanner}<div style="padding:16px;background:linear-gradient(135deg,#1565c0,#0097a7);border-radius:10px;margin-bottom:24px;"><p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#b2ebf2;">New Order</p><p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">${orderNumber}</p></div>${sectionHeading('Order Details')}<table style="width:100%;border-collapse:collapse;">${detailRow('Service', serviceType, true)}${detailRow('Estimated Amount', '<span style="font-weight:600;color:#059669;">$' + estimatedAmount.toFixed(2) + '</span>')}${detailRow('Payment', '💳 Card saved — charge after service', true)}${detailRow('Frequency', isRecurring ? formatServiceInterval(serviceInterval) : 'One-time')}</table>${sectionHeading('Customer')}<table style="width:100%;border-collapse:collapse;">${detailRow('Name', customerName, true)}${detailRow('Email', '<a href="mailto:' + customerEmail + '" style="color:#1565c0;text-decoration:none;">' + customerEmail + '</a>')}${detailRow('Phone', '<a href="tel:' + customerPhone + '" style="color:#1565c0;text-decoration:none;">' + customerPhone + '</a>', true)}</table>${sectionHeading('Boat & Location')}<table style="width:100%;border-collapse:collapse;">${detailRow('Boat', boatName || 'N/A', true)}${detailRow('Length', boatLength ? boatLength + ' ft' : 'N/A')}${detailRow('Make / Model', (boatMake || boatModel) ? [boatMake, boatModel].filter(Boolean).join(' ') : 'N/A', true)}${detailRow('Type / Hull', [boatType, hullType].filter(Boolean).join(' / ') || 'N/A')}${detailRow('Marina', marinaName || 'N/A', true)}${detailRow('Dock / Slip', [dock, slipNumber].filter(Boolean).join(' / ') || 'N/A')}</table>${serviceBreakdown?.items?.length ? `${sectionHeading('Price Breakdown')}<table style="width:100%;border-collapse:collapse;">${serviceBreakdown.items.map((item, index) => detailRow(item.description, '$' + item.amount.toFixed(2), index % 2 === 0)).join('')}<tr style="background-color:#1565c0;"><td style="padding:12px 14px;font-size:14px;font-weight:600;color:#ffffff;">Total</td><td style="padding:12px 14px;font-size:14px;font-weight:600;color:#ffffff;">$${serviceBreakdown.total.toFixed(2)}</td></tr></table>` : ''}${customerNotes ? `${sectionHeading('Customer Notes')}<div style="padding:14px 16px;background-color:#f8fafc;border-left:3px solid #0097a7;border-radius:4px;"><p style="margin:0;font-size:14px;white-space:pre-wrap;color:#334155;">${customerNotes}</p></div>` : ''}<div style="margin-top:24px;padding:14px 16px;background-color:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;"><p style="margin:0;font-size:14px;color:#92400e;"><strong>Action Required:</strong> Review this order and schedule the service.</p></div>`
  return emailLayout(`New Order — ${orderNumber}`, body)
}

function generateOrderConfirmationEmail(
  orderNumber: string, customerName: string, serviceType: string, estimatedAmount: number,
  isRecurring: boolean, serviceInterval: string, cardBrand: string | null, cardLast4: string | null,
): string {
  const cardLine = (cardBrand && cardLast4)
    ? `<p style="margin:6px 0 0;font-size:12px;color:#0e7490;">Card on file: ${cardBrand} ····${cardLast4}</p>` : ''
  const paymentNote = isRecurring
    ? `Your card is securely saved and will be charged after each service completion (${formatServiceInterval(serviceInterval)}).`
    : `Your card is securely saved and will be charged $${estimatedAmount.toFixed(2)} after service completion.`
  const body = `<div style="text-align:center;margin-bottom:28px;"><div style="display:inline-block;width:56px;height:56px;background-color:#ecfdf5;border-radius:50%;line-height:56px;font-size:28px;margin-bottom:12px;">✅</div><h1 style="margin:0;font-size:24px;font-weight:700;color:#1e293b;">Order Confirmed</h1></div><p style="font-size:16px;color:#334155;margin:0 0 20px;">Hi ${customerName},</p><p style="font-size:15px;color:#475569;margin:0 0 24px;">Thank you for your order. Here are the details:</p><table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${detailRow('Order Number', '<span style="font-family:monospace;font-weight:600;">' + orderNumber + '</span>', true)}${detailRow('Service', serviceType)}${detailRow('Frequency', formatServiceInterval(serviceInterval), true)}${detailRow('Estimated Cost', '$' + estimatedAmount.toFixed(2))}</table><div style="padding:14px 16px;background:linear-gradient(135deg,#e0f2fe,#e0f7fa);border-left:3px solid #0097a7;border-radius:4px;margin-bottom:24px;"><p style="margin:0;font-size:14px;color:#0e7490;"><strong>Payment Method Saved</strong></p><p style="margin:6px 0 0;font-size:13px;color:#155e75;">${paymentNote}</p>${cardLine}</div><p style="font-size:15px;color:#334155;margin:0 0 6px;font-weight:600;">What's Next?</p><p style="font-size:14px;color:#475569;margin:0 0 24px;">I'll be in touch to schedule your first service. You'll receive a notification once it's complete, along with underwater photos and a service report.</p><p style="font-size:14px;color:#64748b;margin:0;">Questions? Reach me at <a href="mailto:diving@briancline.co" style="color:#1565c0;text-decoration:none;">diving@briancline.co</a></p>`
  return emailLayout('Order Confirmation', body)
}

function formatServiceInterval(interval: string): string {
  const intervalMap: Record<string, string> = {
    'one-time': 'One-time service', 'one_time': 'One-time service',
    'monthly': 'Monthly', 'bimonthly': 'Every 2 months', 'quarterly': 'Every 3 months',
    '1': 'Monthly', '2': 'Every 2 months', '3': 'Every 3 months', '6': 'Every 6 months',
  }
  return intervalMap[interval] || 'One-time service'
}
