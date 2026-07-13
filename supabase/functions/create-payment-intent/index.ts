import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0?target=deno'
import {
  validateLead,
  verifyTurnstile,
  DEFAULT_ALLOWED_MARINAS,
  type LeadFormData,
} from '../_shared/lead-validation.ts'

const stripeMode = Deno.env.get('STRIPE_MODE') || 'test'
const stripeSecretKey = stripeMode === 'live'
  ? Deno.env.get('STRIPE_SECRET_KEY_LIVE')
  : Deno.env.get('STRIPE_SECRET_KEY_TEST')

console.log(`Stripe mode: ${stripeMode.toUpperCase()}`)

const stripe = new Stripe(stripeSecretKey ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY') || undefined

const allowedOrigins = [
  'https://briancline.co',
  'https://www.briancline.co',
  'https://cost-calculator-sigma.vercel.app',
  'https://sailorskills-estimator.vercel.app',
  'https://sailorskills-estimator-309d9lol8-brians-projects-bc2d3592.vercel.app',
  'https://diving.sailorskills.com',
  'https://sailorskills-site-redesign.sailorskills.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5175'
]

function getCorsHeaders(origin: string | null) {
  const isAllowed = origin && allowedOrigins.includes(origin)
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

interface RateBucket { count: number; resetTime: number }
const rateLimitByIp = new Map<string, RateBucket>()
const rateLimitByEmail = new Map<string, RateBucket>()

function checkBucket(map: Map<string, RateBucket>, key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = map.get(key)
  if (!bucket || now > bucket.resetTime) {
    map.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }
  if (bucket.count >= max) return false
  bucket.count++
  return true
}

function checkRateLimits(ip: string | null, email: string | null): { ok: boolean; reason?: string } {
  if (ip) {
    if (!checkBucket(rateLimitByIp, ip, 2, 60 * 60 * 1000)) {
      return { ok: false, reason: `ip:${ip}` }
    }
  }
  if (email) {
    if (!checkBucket(rateLimitByEmail, email.toLowerCase(), 3, 24 * 60 * 60 * 1000)) {
      return { ok: false, reason: `email:${email}` }
    }
  }
  return { ok: true }
}

async function loadAllowedMarinas(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('marinas').select('name').eq('is_allowed', true)
    if (error) {
      console.warn('marinas.is_allowed query failed; using fallback list:', error.message)
      return DEFAULT_ALLOWED_MARINAS
    }
    const names = (data || []).map((r: { name: string }) => r.name).filter(Boolean)
    return names.length > 0 ? names : DEFAULT_ALLOWED_MARINAS
  } catch {
    return DEFAULT_ALLOWED_MARINAS
  }
}

// Resolve the servicing provider's auth.uid — which is `service_providers.owner_user_id`,
// NOT `service_providers.id`. This is the dual-referent gotcha: service_orders.provider_id
// and boats.provider_id key on the provider's owner_user_id (auth.uid), because that's
// what Pro's provider-scoped queries filter on. Stamping the wrong id makes the order
// invisible to every provider. Derive from context — never hardcode a UUID — so this
// generalizes when more providers come online.
async function resolveProviderOwnerUserId(
  supabase: any,
  payload: any,
  formData: any,
): Promise<string | null> {
  // 1. Explicit provider context from the storefront. Accepts either the provider's
  //    owner_user_id OR service_providers.id, and normalizes to owner_user_id.
  const hint = payload?.providerId || payload?.provider_id || formData?.providerId || null
  if (hint) {
    const { data } = await supabase
      .from('service_providers').select('owner_user_id')
      .or(`owner_user_id.eq.${hint},id.eq.${hint}`)
      .not('owner_user_id', 'is', null).limit(1).maybeSingle()
    if (data?.owner_user_id) return data.owner_user_id as string
  }
  // 2. Deployment-level override (configuration, not a hardcoded UUID in the logic).
  const envOwner = Deno.env.get('DEFAULT_PROVIDER_OWNER_USER_ID')
  if (envOwner) return envOwner
  // 3. Fall back to the sole active Pro provider. Correct while exactly one provider
  //    backs this storefront; if more than one exists we return null so the caller
  //    fails closed rather than guessing which provider owns the order.
  const { data: active } = await supabase
    .from('service_providers').select('owner_user_id')
    .eq('pro_enabled', true).eq('is_active', true)
    .not('owner_user_id', 'is', null).limit(2)
  if (active && active.length === 1) return active[0].owner_user_id as string
  return null
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  const remoteIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const payload = await req.json()
    const formData = payload.formData as LeadFormData & Record<string, any>

    if (!formData) {
      return new Response(JSON.stringify({ error: 'Missing formData' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    // Canonicalize the one-time marker. The order form sends "one_time" (underscore)
    // for one-time *cleaning* orders but the literal "one-time" (hyphen) for other
    // one-time services. Every downstream recurring check below compares against
    // "one-time", so without this an underscore one-time order is misread as
    // recurring — creating a service_schedule, flipping auto_charge_enabled, and
    // tagging it recurring_cleaning. Normalize once, here.
    if (formData.serviceInterval === 'one_time') formData.serviceInterval = 'one-time'
    if (formData.serviceDetails?.frequency === 'one_time') formData.serviceDetails.frequency = 'one-time'

    const rl = checkRateLimits(remoteIp, formData.customerEmail || null)
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 })
    }

    const turnstile = await verifyTurnstile(formData.turnstileToken, turnstileSecret, remoteIp)
    if (!turnstile.ok) {
      return new Response(JSON.stringify({ error: 'Verification failed. Please refresh and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const sanitize = (text: string): string => {
      if (!text) return text
      return text.replace(/[<>]/g, '').trim().slice(0, 1000)
    }
    formData.customerName = sanitize(formData.customerName as string)
    formData.customerNotes = sanitize((formData.customerNotes as string) || '')
    formData.boatName = sanitize((formData.boatName as string) || '')
    formData.boatMake = sanitize((formData.boatMake as string) || '')
    formData.boatModel = sanitize((formData.boatModel as string) || '')
    if (formData.recoveryLocation) formData.recoveryLocation = sanitize(formData.recoveryLocation)
    if (formData.itemDescription) formData.itemDescription = sanitize(formData.itemDescription)

    const allowedMarinas = await loadAllowedMarinas(supabase)
    const isItemRecovery = formData.service === 'Item Recovery'
    const lead = validateLead(formData as LeadFormData, {
      allowedMarinas, turnstileSecret, remoteIp, skipBoatAndMarina: isItemRecovery,
    })
    if (!lead.ok) {
      return new Response(JSON.stringify({ error: lead.error || 'Submission rejected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: lead.status || 400 })
    }
    const requiresReview = !!lead.requiresReview

    const auth = (formData as any).authorization
    if (!auth || typeof auth !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing authorization payload' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }
    if (auth.agreedToTerms !== true || auth.agreedToCharge !== true) {
      return new Response(JSON.stringify({ error: 'You must accept the Terms of Service and the charge authorization to continue.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }
    const typedName = sanitize(String(auth.typedName || ''))
    if (!typedName || typedName.length < 2) {
      return new Response(JSON.stringify({ error: 'Typed name is required to authorize.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }
    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
    if (normalize(typedName) !== normalize(formData.customerName as string)) {
      return new Response(JSON.stringify({ error: 'Typed name must match the customer name on the order.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }
    if (!auth.termsVersion || typeof auth.termsVersion !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing terms version' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }
    const { data: tosRow } = await supabase
      .from('terms_documents').select('version')
      .eq('version', auth.termsVersion).eq('document_type', 'tos').maybeSingle()
    if (!tosRow) {
      return new Response(JSON.stringify({ error: 'Terms version not recognized. Please refresh and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    // Resolve the servicing provider BEFORE any DB write and fail closed if we can't.
    // A provider-less order (provider_id = NULL) is invisible to every provider in the
    // Pro Orders queue, so it must never be created. This guard is the fix for the
    // regression where card-on-file orders were stamped with provider_id = NULL.
    const providerOwnerUserId = await resolveProviderOwnerUserId(supabase, payload, formData)
    if (!providerOwnerUserId) {
      console.error('[create-payment-intent] Could not resolve servicing provider; refusing to create a provider-unstamped order')
      return new Response(JSON.stringify({ error: 'Could not determine the servicing provider for this order. Please try again or contact support.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const { data: pricingData } = await supabase.from('business_pricing_config').select('config_key, config_value')
    let pricingConfig: Record<string, number> = {}
    if (pricingData) {
      pricingConfig = pricingData.reduce((acc, row) => {
        acc[row.config_key] = parseFloat(row.config_value); return acc
      }, {} as Record<string, number>)
    }

    const validatePrice = (estimate: number, service: string, details: any): boolean => {
      const MIN_CHARGE = pricingConfig['minimum_service_charge'] || 99
      const serviceRates: Record<string, any> = {
        'Cleaning & Anodes': {
          rate: details?.frequency === 'one_time' || formData.serviceInterval === 'one-time'
            ? (pricingConfig['onetime_cleaning_rate'] || 6.00) : (pricingConfig['recurring_cleaning_rate'] || 4.50),
          type: 'per_foot',
        },
        'Item Recovery': { rate: pricingConfig['item_recovery_rate'] || 199, type: 'flat' },
        'Underwater Inspection': { rate: pricingConfig['underwater_inspection_rate'] || 3.99, type: 'per_foot' },
        'Propeller Service': { rate: pricingConfig['propeller_service_rate'] || 349, type: 'flat' },
        'Anodes Only': { rate: pricingConfig['anodes_only_rate'] || 149, type: 'flat' },
      }
      const serviceConfig = serviceRates[service]
      if (!serviceConfig) return false
      if (serviceConfig.type === 'flat') {
        return estimate >= serviceConfig.rate && estimate <= serviceConfig.rate * 5
      } else {
        const boatLength = parseInt(details?.boatLength || formData.boatLength || '0')
        if (boatLength < 10 || boatLength > 300) return false
        const basePrice = Math.max(boatLength * serviceConfig.rate, MIN_CHARGE)
        const maxPrice = basePrice * 4
        return estimate >= MIN_CHARGE && estimate <= maxPrice
      }
    }
    if (!validatePrice(formData.estimate, formData.service, formData.serviceDetails)) {
      throw new Error('Invalid price calculation')
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers').upsert({
        email: formData.customerEmail, name: formData.customerName,
        phone: formData.customerPhone, birthday: formData.customerBirthday || null,
      }, { onConflict: 'email' }).select().single()
    if (customerError) throw customerError
    if (!customer) throw new Error('Failed to create or retrieve customer')

    let stripeCustomer; let needsNewCustomer = false
    if (customer.stripe_customer_id) {
      try {
        stripeCustomer = await stripe.customers.retrieve(customer.stripe_customer_id)
        if ((stripeCustomer as any).deleted) needsNewCustomer = true
      } catch { needsNewCustomer = true }
    } else {
      needsNewCustomer = true
    }
    if (needsNewCustomer) {
      stripeCustomer = await stripe.customers.create({
        email: formData.customerEmail, name: formData.customerName, phone: formData.customerPhone,
        address: {
          line1: formData.billingAddress, city: formData.billingCity, state: formData.billingState, country: 'US',
        },
      })
      await supabase.from('customers').update({ stripe_customer_id: stripeCustomer.id }).eq('id', customer.id)
    }

    const { data: existingAddress } = await supabase.from('addresses')
      .select('*').eq('customer_id', customer.id).eq('type', 'billing').single()
    const addressData = {
      customer_id: customer.id, type: 'billing', street: formData.billingAddress,
      city: formData.billingCity, state: formData.billingState, zip: formData.billingZip || null,
    }
    if (existingAddress) {
      await supabase.from('addresses').update(addressData).eq('id', existingAddress.id)
    } else {
      await supabase.from('addresses').insert(addressData)
    }

    let boat = null
    if (formData.service !== 'Item Recovery') {
      const boatData: any = {
        customer_id: customer.id, provider_id: providerOwnerUserId,
        customer_name: formData.customerName,
        customer_email: formData.customerEmail, customer_phone: formData.customerPhone,
        // Populate owner_* / billing_email so the boat isn't orphaned (invisible in
        // Pro's boat search, which requires provider_id + is_active + owner context).
        owner_name: formData.customerName, owner_email: formData.customerEmail,
        billing_email: formData.customerEmail,
        name: formData.boatName, make: formData.boatMake, model: formData.boatModel,
        length: parseInt(formData.boatLength) || 0, marina: formData.marinaName || null,
        dock: formData.dock || null, slip: formData.slipNumber || null, is_active: true,
      }
      if (formData.serviceDetails) {
        if (formData.serviceDetails.boatType) boatData.type = formData.serviceDetails.boatType
        if (formData.serviceDetails.hullType) boatData.hull_type = formData.serviceDetails.hullType
        if (formData.serviceDetails.twinEngines !== undefined) boatData.twin_engines = formData.serviceDetails.twinEngines
      }
      const { data: existingBoat } = await supabase.from('boats').select('*')
        .or(`and(customer_id.eq.${customer.id},name.eq.${formData.boatName}),and(customer_email.eq.${formData.customerEmail},name.eq.${formData.boatName})`)
        .limit(1).maybeSingle()
      if (existingBoat) {
        const { data: updatedBoat } = await supabase.from('boats').update(boatData).eq('id', existingBoat.id).select().single()
        boat = updatedBoat
      } else {
        const { data: newBoat } = await supabase.from('boats').insert(boatData).select().single()
        boat = newBoat
      }
    }

    let marina = null
    if (formData.service !== 'Item Recovery' && formData.marinaName && formData.marinaName !== 'See recovery location') {
      const marinaResult = await supabase.from('marinas').upsert({ name: formData.marinaName }, { onConflict: 'name' }).select().single()
      marina = marinaResult.data
    }

    // Idempotency / double-submit guard. A confirmed double-submit created two identical
    // orders ~20s apart (duplicate service_orders + order_authorizations + setup intents).
    // Before creating a new order, look for a very-recent identical still-open order for
    // this customer/boat/service/amount and, if found, return its existing setup intent
    // instead of duplicating everything below. Customer/boat/address/marina above are all
    // upserts/updates, so they don't duplicate; only what follows this point does.
    {
      const DEDUPE_WINDOW_MS = 2 * 60 * 1000
      const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()
      let dupQuery = supabase.from('service_orders')
        .select('id, order_number, stripe_setup_intent_id, requires_review')
        .eq('customer_id', customer.id)
        .eq('service_type', formData.service)
        .eq('estimated_amount', formData.estimate)
        .in('status', ['pending', 'pending_review'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
      dupQuery = boat?.id ? dupQuery.eq('boat_id', boat.id) : dupQuery.is('boat_id', null)
      const { data: recentDup } = (await dupQuery.maybeSingle()) as { data: any }
      if (recentDup?.stripe_setup_intent_id) {
        try {
          const existingIntent = await stripe.setupIntents.retrieve(recentDup.stripe_setup_intent_id)
          if (existingIntent?.client_secret && existingIntent.status !== 'canceled') {
            console.log(`[create-payment-intent] Idempotent reuse of recent order ${recentDup.order_number} (${recentDup.id})`)
            return new Response(JSON.stringify({
              clientSecret: existingIntent.client_secret, intentType: 'setup',
              orderId: recentDup.id, orderNumber: recentDup.order_number,
              requiresReview: recentDup.requires_review, deduped: true,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
          }
        } catch (e) {
          console.warn('[create-payment-intent] Could not reuse recent setup intent; creating a new order:', (e as Error).message)
        }
      }
    }

    // Promo code claim. Placed after the dedupe block (so a deduped resubmit returns
    // early above and never re-burns the once-per-customer redemption) and before the
    // order is constructed, so a successful claim can be stamped onto orderData below.
    const promoCode = typeof formData.promoCode === 'string' ? formData.promoCode.trim().slice(0, 64) : ''
    let promoRedemptionId: string | null = null
    let promoApplied: { code: string; percentApplied: number } | null = null
    if (promoCode) {
      const { data: promoData, error: promoRpcError } = await supabase.rpc('claim_service_promo', {
        p_code: promoCode,
        p_email: formData.customerEmail,
        p_is_recurring: formData.serviceInterval !== 'one-time',
      })
      if (promoRpcError) {
        return new Response(JSON.stringify({
          error: 'We could not validate your promo code right now. Please remove the code and try again, or retry in a moment.',
          promoError: 'rpc_failure',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
      }
      const promoRow = Array.isArray(promoData) ? promoData[0] : promoData
      if (promoRow?.error_code) {
        const promoErrorMessages: Record<string, string> = {
          invalid_code: "That promo code isn't valid.",
          already_used: 'That promo code has already been used.',
          expired: 'That promo code has expired.',
        }
        return new Response(JSON.stringify({
          error: promoErrorMessages[promoRow.error_code] || 'That promo code could not be applied.',
          promoError: promoRow.error_code,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
      }
      promoRedemptionId = promoRow?.redemption_id ?? null
      promoApplied = { code: promoCode.toUpperCase(), percentApplied: promoRow?.percent_applied }
    }

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
    const orderData: any = {
      order_number: orderNumber, provider_id: providerOwnerUserId,
      customer_id: customer.id, boat_id: boat?.id || null,
      marina_id: marina?.id || null, dock: formData.dock || null, slip_number: formData.slipNumber || null,
      service_type: formData.service, service_interval: formData.serviceInterval || 'one-time',
      estimated_amount: formData.estimate, status: requiresReview ? 'pending_review' : 'pending',
      service_details: formData.serviceDetails || null, notes: formData.customerNotes || null,
      requires_review: requiresReview,
    }
    if (promoRedemptionId) {
      orderData.promo_redemption_id = promoRedemptionId
    }
    if (formData.service === 'Item Recovery') {
      orderData.metadata = {
        recoveryLocation: formData.recoveryLocation, itemDescription: formData.itemDescription, lostDate: formData.dropDate,
      }
    }
    const { data: order, error: orderError } = await supabase.from('service_orders').insert(orderData).select().single()
    if (orderError) throw orderError
    if (!order) throw new Error('Failed to create order')

    if (formData.serviceInterval !== 'one-time' && !requiresReview) {
      const intervalMonths = { '1': 1, '2': 2, '3': 3, '6': 6 }[formData.serviceInterval] || 1
      await supabase.from('service_schedules').insert({
        customer_id: customer.id, boat_id: boat?.id,
        service_type: formData.service, interval_months: intervalMonths,
        next_service_date: new Date(Date.now() + (intervalMonths * 30 * 24 * 60 * 60 * 1000)),
      })
    }

    const serviceTypeMap: Record<string, string> = {
      'Cleaning & Anodes': formData.serviceInterval === 'one-time' ? 'onetime_cleaning' : 'recurring_cleaning',
      'Underwater Inspection': 'underwater_inspection', 'Item Recovery': 'item_recovery',
      'Propeller Service': 'propeller_service', 'Anodes Only': 'anodes_only',
    }
    const frequencyMap: Record<string, string> = {
      'one-time': 'one-time', '1': 'monthly', '2': 'two_months', '3': 'quarterly', '6': 'biannual',
    }
    const customerServiceData = {
      customer_id: stripeCustomer.id, boat_id: boat?.id || null,
      service_type: serviceTypeMap[formData.service] || 'onetime_cleaning',
      service_name: formData.service,
      frequency: frequencyMap[formData.serviceInterval] || 'one-time',
      base_price: formData.estimate, boat_length: parseInt(formData.boatLength) || null,
      includes_anodes: formData.serviceDetails?.includesAnodes || false,
      twin_engines: formData.serviceDetails?.twinEngines || false,
      hull_type: formData.serviceDetails?.hullType || null,
      boat_type: formData.serviceDetails?.boatType || null,
      status: requiresReview ? 'pending_review' : 'active',
      notes: formData.customerNotes || null,
    }
    await supabase.from('customer_services').insert(customerServiceData)

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomer.id, payment_method_types: ['card'], usage: 'off_session',
      metadata: {
        order_id: order.id, order_number: orderNumber, service_type: formData.service,
        service_interval: formData.serviceInterval, estimated_amount: formData.estimate.toString(),
        requires_review: String(requiresReview),
      },
    })
    const clientSecret = setupIntent.client_secret
    const intentType = 'setup'

    const isRecurringOrder = formData.serviceInterval !== 'one-time'
    const annualizedCents = (() => {
      if (!isRecurringOrder) return null
      const monthsBetween = parseInt(formData.serviceInterval) || 1
      if (monthsBetween < 1) return null
      const perYear = Math.round(12 / monthsBetween)
      return Math.round(Number(formData.estimate) * 100 * perYear)
    })()

    const { data: authRow, error: authError } = await supabase
      .from('order_authorizations').insert({
        customer_id: customer.id, service_order_id: order.id, authorization_ip: remoteIp,
        user_agent: typeof auth.userAgent === 'string' ? auth.userAgent.slice(0, 1000) : null,
        typed_name: typedName, terms_version: auth.termsVersion,
        recurring_terms_version: isRecurringOrder ? (auth.recurringTermsVersion || auth.termsVersion) : null,
        quoted_price_cents: Math.round(Number(formData.estimate) * 100),
        quoted_frequency: formData.serviceInterval, quoted_service_type: formData.service,
        quoted_annualized_cents: annualizedCents,
        quote_snapshot: {
          service: formData.service, interval: formData.serviceInterval, estimate: formData.estimate,
          boatLength: formData.boatLength, boatType: formData.serviceDetails?.boatType,
          hullType: formData.serviceDetails?.hullType, serviceDetails: formData.serviceDetails || null,
          referer: auth.referer || null,
          authorizedAt: auth.authorizedAt || new Date().toISOString(),
        },
        is_recurring: isRecurringOrder, stripe_customer_id: stripeCustomer.id,
        stripe_setup_intent_id: setupIntent.id,
      }).select('id').single()
    if (authError) {
      console.error('Failed to write order_authorizations:', authError)
      try { await stripe.setupIntents.cancel(setupIntent.id) } catch (e) { console.error('cancel failed:', e) }
      throw new Error('Could not record authorization')
    }

    await supabase.from('service_orders').update({
      stripe_customer_id: stripeCustomer.id,
      stripe_setup_intent_id: setupIntent.id,
      order_authorization_id: authRow.id,
    }).eq('id', order.id)

    return new Response(JSON.stringify({
      clientSecret, intentType, orderId: order.id, orderNumber, requiresReview,
      ...(promoApplied ? { promoApplied } : {}),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error: any) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
