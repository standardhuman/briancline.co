// Lead-quality validation for the briancline.co order form.
//
// Runs BEFORE any DB write or Stripe call, so junk submissions don't
// pollute customers/boats/marinas/service_orders/service_schedules.
//
// All checks are server-side. Do not rely on the client to enforce these.

export interface LeadFormData {
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  billingState?: string
  billingZip?: string
  boatName?: string
  boatMake?: string
  boatModel?: string
  boatLength?: string | number
  marinaName?: string
  websiteUrl?: string
  turnstileToken?: string
  service?: string
  customerNotes?: string
}

export interface ValidationResult {
  ok: boolean
  status?: number
  error?: string
  requiresReview?: boolean
}

export const DEFAULT_ALLOWED_MARINAS: string[] = [
  'berkeley marina','emery cove yacht harbor','emeryville marina',
  'marina bay','marina bay yacht harbor','brickyard cove marina',
  'point richmond','richmond yacht club','grand marina','marina village',
  'ballena bay','ballena isle marina','alameda marina','pacific marina',
  'oakland yacht club','encinal yacht club','jack london square marina',
  'embarcadero cove','pier 39 marina','south beach harbor','pier 1.5',
  'pier 39','sf marina','san francisco marina','gashouse cove','west harbor',
  'travis marina','sausalito yacht harbor','schoonmaker point marina',
  'clipper yacht harbor','kappas marina','loch lomond marina',
  'paradise cay yacht harbor','corinthian yacht club','tiburon yacht club',
  'vallejo yacht club','glen cove marina','benicia marina','martinez marina',
  'pittsburg marina','antioch marina',
]

function normalizeMarina(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function uniqueChars(s: string): number {
  return new Set(s.toLowerCase().replace(/[^a-z0-9]/g, '')).size
}

function looksLikeJunkString(s: string): boolean {
  if (!s) return false
  const cleaned = s.trim()
  if (cleaned.length < 3) return true
  if (uniqueChars(cleaned) <= 2) return true
  if (/(.)\1{3,}/.test(cleaned)) return true
  return false
}

export interface MarinaCheck { matched: boolean; normalized: string }

export function checkMarina(marinaName: string | undefined, allowList: string[]): MarinaCheck {
  const normalized = normalizeMarina(marinaName || '')
  if (!normalized) return { matched: false, normalized }
  const matched = allowList.some((a) => {
    const n = normalizeMarina(a)
    return n === normalized || normalized.includes(n) || n.includes(normalized)
  })
  return { matched, normalized }
}

export async function verifyTurnstile(
  token: string | undefined,
  secret: string | undefined,
  remoteIp: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  if (!secret) return { ok: true }
  if (!token) return { ok: false, reason: 'turnstile-missing' }
  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.append('remoteip', remoteIp)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body,
    })
    const data = await res.json() as { success?: boolean; 'error-codes'?: string[] }
    if (!data.success) {
      return { ok: false, reason: `turnstile-failed:${(data['error-codes'] || []).join(',')}` }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'turnstile-network-error' }
  }
}

export interface ValidateLeadOptions {
  allowedMarinas: string[]
  turnstileSecret?: string
  remoteIp?: string | null
  skipBoatAndMarina?: boolean
}

export function validateLead(form: LeadFormData, opts: ValidateLeadOptions): ValidationResult {
  if (form.websiteUrl && form.websiteUrl.trim() !== '') {
    return { ok: false, status: 400, error: 'invalid request' }
  }
  if (!form.customerEmail || !/.+@.+\..+/.test(form.customerEmail)) {
    return { ok: false, status: 400, error: 'A valid email is required.' }
  }
  if (!form.customerName || form.customerName.trim().length < 2) {
    return { ok: false, status: 400, error: 'A valid name is required.' }
  }
  if (form.customerName.trim().split(/\s+/).filter(Boolean).length === 1
      && form.customerName.trim().length < 4) {
    return { ok: false, status: 400, error: 'Please provide your full name.' }
  }
  // NOTE: service area is gated by the boat's marina (see the marina allowlist
  // check below), NOT by the customer's billing address. Billing ZIP/state belong
  // to the payment card and must pass through to Stripe untouched for AVS — gating
  // on them blocked legitimate out-of-area cardholders whose boats berth locally.
  if (!opts.skipBoatAndMarina) {
    if (looksLikeJunkString(form.boatName || '')) {
      return { ok: false, status: 400, error: 'Please enter a valid boat name.' }
    }
    if (form.boatMake && looksLikeJunkString(form.boatMake)) {
      return { ok: false, status: 400, error: 'Please enter a valid boat make.' }
    }
    const len = typeof form.boatLength === 'string' ? parseInt(form.boatLength) : form.boatLength
    if (!len || len < 10 || len > 200) {
      return { ok: false, status: 400, error: 'Boat length must be between 10 and 200 feet.' }
    }
    if (looksLikeJunkString(form.marinaName || '')) {
      return { ok: false, status: 400, error: 'Please enter a valid marina.' }
    }
    const marinaCheck = checkMarina(form.marinaName, opts.allowedMarinas)
    if (!marinaCheck.matched) {
      return { ok: true, requiresReview: true }
    }
  }
  return { ok: true }
}
