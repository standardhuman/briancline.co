// The customer's optional "Any scheduling needs?" answer from the order form,
// stored as service_orders.service_details.schedulingRequest (kept separate from
// the free-form notes column), plus the email copy that depends on it.
//
// Pure and dependency-free so both edge functions (Deno) and vitest can import it.

export const SCHEDULING_REQUEST_MAX_LENGTH = 1000

/** Same rule as create-payment-intent's sanitize(): strip angle brackets, trim, cap. */
export function normalizeSchedulingRequest(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[<>]/g, '').trim().slice(0, SCHEDULING_REQUEST_MAX_LENGTH)
}

/** Read the stored request off a service_details jsonb value (never trusted). */
export function readSchedulingRequest(serviceDetails: unknown): string {
  if (!serviceDetails || typeof serviceDetails !== 'object') return ''
  return normalizeSchedulingRequest((serviceDetails as Record<string, unknown>).schedulingRequest)
}

export const WHATS_NEXT_WITH_REQUEST =
  "Thanks for the scheduling note. I'll plan around it and let you know if anything doesn't work."
export const WHATS_NEXT_WITHOUT_REQUEST =
  "I'll typically get you on the schedule within the next few weeks."
export const WHATS_NEXT_AFTER_SERVICE =
  "Once each service is complete, you'll get an email with before and after videos of your hull and a service report."

/** The two sentences of the confirmation email's "What's Next?" paragraph. */
export function whatsNextCopy(schedulingRequest: string | null | undefined): string[] {
  const hasRequest = normalizeSchedulingRequest(schedulingRequest ?? '') !== ''
  return [hasRequest ? WHATS_NEXT_WITH_REQUEST : WHATS_NEXT_WITHOUT_REQUEST, WHATS_NEXT_AFTER_SERVICE]
}

/** The customer confirmation email's "What's Next?" heading and paragraph. */
export function renderWhatsNextBlock(schedulingRequest: string | null | undefined): string {
  return `<p style="font-size:15px;color:#334155;margin:0 0 6px;font-weight:600;">What's Next?</p>`
    + `<p style="font-size:14px;color:#475569;margin:0 0 24px;">${whatsNextCopy(schedulingRequest).join(' ')}</p>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * The admin "New Order" email's "Scheduling Needs" section, or '' when the
 * customer left the field blank. `sectionHeading` is the caller's own heading
 * renderer so the section matches the rest of that email.
 */
export function renderSchedulingRequestAdminSection(
  schedulingRequest: string | null | undefined,
  sectionHeading: (text: string) => string,
): string {
  const request = normalizeSchedulingRequest(schedulingRequest ?? '')
  if (!request) return ''
  return sectionHeading('Scheduling Needs')
    + `<div style="padding:14px 16px;background-color:#f8fafc;border-left:3px solid #f59e0b;border-radius:4px;"><p style="margin:0;font-size:14px;white-space:pre-wrap;color:#334155;">${escapeHtml(request)}</p></div>`
}
