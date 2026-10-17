// Pay-by-invoice terms, client copy.
//
// Shown on the order form when the customer picks "Pay by invoice (requires
// approval)". The form posts INVOICE_TERMS_VERSION back and the server rejects
// any version other than its own copy in
// supabase/functions/_shared/invoice-terms.ts. Both copies MUST stay identical
// (tests/invoice-terms-parity.test.ts enforces it). To change the wording: edit
// both files, bump the version in both, and deploy create-payment-intent first.

export const INVOICE_TERMS_VERSION = "2026-10-17";

export const INVOICE_TERMS_TEXT = Object.freeze([
  "We email an invoice after each visit, along with your service report.",
  "Payment is due within 7 days by Zelle, Venmo, check, or the secure card link in the invoice. Paying through the link does not save your card.",
  "If a payment is more than 14 days late, we may hold your next scheduled service until the balance is paid.",
  "If payments run late, we may ask for a card on file to continue service.",
  "Pay-by-invoice requests are reviewed before your order is confirmed.",
]);
