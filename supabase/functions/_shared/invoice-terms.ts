// Pay-by-invoice terms, server copy.
//
// The order form shows these lines to a customer who picks "Pay by invoice
// (requires approval)" and posts back the version it showed. The server only
// accepts that version, and stores the version plus this exact text in the
// order_authorizations.quote_snapshot so we can show what the customer agreed to.
//
// The client copy lives at src/services/pages/legal/invoice-terms.js and MUST
// stay identical (tests/invoice-terms-parity.test.ts enforces it). To change the
// wording: edit both files, bump INVOICE_TERMS_VERSION in both, and redeploy
// create-payment-intent before (or with) the site.

export const INVOICE_TERMS_VERSION = '2026-10-17'

export const INVOICE_TERMS_TEXT: readonly string[] = Object.freeze([
  'We email an invoice after each visit, along with your service report.',
  'Payment is due within 7 days by Zelle, Venmo, check, or the secure card link in the invoice. Paying through the link does not save your card.',
  'If a payment is more than 14 days late, we may hold your next scheduled service until the balance is paid.',
  'If payments run late, we may ask for a card on file to continue service.',
  'Pay-by-invoice requests are reviewed before your order is confirmed.',
])

export type PaymentPreference = 'card' | 'invoice'

export type PaymentPreferenceResult =
  | { ok: true; preference: PaymentPreference }
  | { ok: false; error: string }

/**
 * Strict parse of formData.paymentPreference. An absent value (undefined/null)
 * means 'card' so clients deployed before this field existed keep working
 * unchanged. Anything else that is not exactly 'card' or 'invoice' is rejected.
 */
export function parsePaymentPreference(value: unknown): PaymentPreferenceResult {
  if (value === undefined || value === null) return { ok: true, preference: 'card' }
  if (value === 'card' || value === 'invoice') return { ok: true, preference: value }
  return { ok: false, error: 'Invalid payment preference.' }
}

/**
 * Consent checks for a pay-by-invoice order. Replaces the card charge
 * authorization check (agreedToCharge) for invoice orders only: the customer
 * must accept the Terms of Service and the pay-by-invoice terms at the exact
 * version this server ships.
 */
export function validateInvoiceAuthorization(auth: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  if (auth.agreedToTerms !== true || auth.agreedToInvoiceTerms !== true) {
    return { ok: false, error: 'You must accept the Terms of Service and the pay-by-invoice terms to continue.' }
  }
  if (auth.invoiceTermsVersion !== INVOICE_TERMS_VERSION) {
    return { ok: false, error: 'Pay-by-invoice terms version not recognized. Please refresh and try again.' }
  }
  return { ok: true }
}

/** Fields merged into order_authorizations.quote_snapshot for an invoice order. */
export function invoiceSnapshotFields(): {
  payment_preference: 'invoice'
  invoice_terms: { version: string; text: string[] }
} {
  return {
    payment_preference: 'invoice',
    invoice_terms: { version: INVOICE_TERMS_VERSION, text: [...INVOICE_TERMS_TEXT] },
  }
}

/**
 * service_orders.metadata for an invoice order. Merges into whatever metadata
 * the order already carries (Item Recovery details, for example); never drops
 * an existing key.
 */
export function withInvoiceMetadata(existing: unknown): Record<string, unknown> {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? existing as Record<string, unknown>
    : {}
  return { ...base, payment_preference: 'invoice' }
}
