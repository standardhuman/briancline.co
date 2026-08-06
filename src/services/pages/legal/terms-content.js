// Canonical legal text for briancline.co. Each version here MUST also exist
// as a row in the terms_documents table (see migration 20260429_chargeback_hardening.sql).
// When you ship a new version: add a new keyed entry below AND insert a matching
// terms_documents row, then bump ACTIVE_VERSION below.
//
// PLACEHOLDER PENDING ATTORNEY REVIEW. Do not scale beyond the existing customer
// base on this text alone.

export const ACTIVE_VERSION = "2026-08-05";

export const TERMS_OF_SERVICE = {
  "2026-05-01": {
    effectiveDate: "May 1, 2026",
    body: `
# SailorSkills Terms of Service

**Version 2026-05-01 — PLACEHOLDER PENDING ATTORNEY REVIEW**

## 1. Acceptance and Electronic Signature

By clicking "Authorize & Save Card" or paying any invoice, you agree to these
Terms of Service. Under the federal E-SIGN Act and California UETA, your
typed name and click-through are equivalent to a handwritten signature.

## 2. Service Description

SailorSkills (Brian Cline, sole proprietor) provides marine services
including hull cleaning, diving inspection, anode replacement, item recovery,
and propeller service. Services are performed in San Francisco Bay Area
marinas only.

## 3. Pricing & Estimates

Estimates shown at order time are based on boat length, service frequency,
and standard conditions. **Your actual charge may exceed the estimate** when:

- Heavy or severe marine growth is found (+50% to +100%)
- Zinc anodes need replacement (per-anode pricing)
- Unusual conditions require extra time

We document and photograph any condition-based surcharge.

## 4. Authorization for One-Time Charges

You authorize SailorSkills to charge the card you provide for the service
you order, in the amount documented in your service report.

## 5. Authorization for Recurring (Saved-Card) Charges

If you authorize automatic charging at order time or invoice payment, you
authorize SailorSkills to charge your saved card for each scheduled service
at the price documented in that service's report. You will receive an email
notification before each scheduled service window. You can cancel automatic
charging any time by emailing diving@briancline.co; cancellation takes effect
immediately for any service not yet performed.

## 6. Cancellation Policy

You may cancel any scheduled service at no charge by replying to the
scheduling notification email at least 24 hours before the service window.
Cancellation of a recurring authorization does not affect charges for
services already performed.

## 7. Refunds

If service was not performed as described, contact diving@briancline.co
within 14 days. We will redo the service or refund the charge. Refunds
typically post within 5-10 business days.

## 8. Dispute Resolution

You agree to contact diving@briancline.co before initiating a credit-card
chargeback or legal action. Disputes are governed by California law and
venue is Alameda County.

## 9. Liability

Our liability is limited to the amount paid for the service in question.
SailorSkills carries marine-services liability insurance; certificates
available on request.

## 10. Photo and Video Use

We capture photos and video of services for your service log. We will not
use them for marketing without separate written permission.

## 11. Force Majeure

If weather, marina access, or other conditions outside our control prevent
service, we will reschedule at no charge.

## 12. Data Retention

Service records, photos, consent artifacts, and charge records are retained
for at least 7 years for tax and dispute-defense purposes.
`.trim(),
  },
  "2026-08-05": {
    effectiveDate: "August 5, 2026",
    body: `
# SailorSkills Terms of Service

## 1. Acceptance and Electronic Signature

By clicking "Authorize & Save Card" or paying any invoice, you agree to these
Terms of Service. Under the federal E-SIGN Act and California UETA, your
typed name and click-through are equivalent to a handwritten signature.

## 2. Service Description

SailorSkills (Brian Cline, sole proprietor) provides marine services
including hull cleaning, diving inspection, anode replacement, item recovery,
and propeller service. Services are performed in San Francisco Bay Area
marinas only.

## 3. Pricing & Estimates

Estimates shown at order time are based on boat length, service frequency,
and standard conditions. **Your actual charge may exceed the estimate** when:

- Heavy or severe marine growth is found (+50% to +100%)
- Zinc anodes need replacement (per-anode pricing)
- Unusual conditions require extra time

We document and photograph any condition-based surcharge.

## 4. Authorization for One-Time Charges

You authorize SailorSkills to charge the card you provide for the service
you order, in the amount documented in your service report.

## 5. Authorization for Recurring (Saved-Card) Charges

If you authorize automatic charging at order time or invoice payment, you
authorize SailorSkills to charge your saved card for each scheduled service
at the price documented in that service's report. You will receive an email
notification before each scheduled service window. You can cancel automatic
charging any time by emailing diving@briancline.co; cancellation takes effect
immediately for any service not yet performed.

## 6. Cancellation Policy

You may cancel any scheduled service at no charge by replying to the
scheduling notification email at least 24 hours before the service window.
Cancellation of a recurring authorization does not affect charges for
services already performed.

## 7. Refunds

If service was not performed as described, contact diving@briancline.co
within 14 days. We will redo the service or refund the charge. Refunds
typically post within 5-10 business days.

## 8. Dispute Resolution

You agree to contact diving@briancline.co before initiating a credit-card
chargeback or legal action. Disputes are governed by California law and
venue is Alameda County.

## 9. Liability

Our liability is limited to the amount paid for the service in question.
SailorSkills carries marine-services liability insurance; certificates
available on request.

## 10. Photo and Video Use

We capture photos and video of services for your service log. We will not
use them for marketing without separate written permission.

## 11. Force Majeure

If weather, marina access, or other conditions outside our control prevent
service, we will reschedule at no charge.

## 12. Data Retention

Service records, photos, consent artifacts, and charge records are retained
for at least 7 years for tax and dispute-defense purposes.
`.trim(),
  },
};

export const RECURRING_AUTHORIZATION = {
  "2026-05-01": {
    effectiveDate: "May 1, 2026",
    body: `
# Recurring Charge Authorization

**Version 2026-05-01 — PLACEHOLDER PENDING ATTORNEY REVIEW**

By saving your card and selecting a recurring service frequency, you
authorize Brian Cline / SailorSkills to charge the saved card for each
scheduled hull cleaning (or other service you ordered) at the price
documented in that service's report.

## Frequency

Monthly, every 2 months, every 3 months, or every 6 months — whatever you
selected at order time.

## Amount

Based on your boat length and the per-foot rate quoted at order time. May
increase if heavy growth, extra anodes, or unusual conditions require it.
Any surcharge will be documented with photos in your service report.

## Notification

You will receive an email when each service is scheduled (with the expected
amount based on your last service) and again when the service is complete
and your card is charged (with the actual amount).

## Right to Cancel

You can cancel automatic charging any time by emailing diving@briancline.co.
Cancellation is effective immediately for any service not yet performed.

## Right to Dispute

Contact diving@briancline.co before initiating a chargeback. Most disputes
are resolved by refund or service redo.
`.trim(),
  },
  "2026-08-05": {
    effectiveDate: "August 5, 2026",
    body: `
# Recurring Charge Authorization

By saving your card and selecting a recurring service frequency, you
authorize Brian Cline / SailorSkills to charge the saved card for each
scheduled hull cleaning (or other service you ordered) at the price
documented in that service's report.

## Frequency

Monthly, every 2 months, every 3 months, or every 6 months — whatever you
selected at order time.

## Amount

Based on your boat length and the per-foot rate quoted at order time. May
increase if heavy growth, extra anodes, or unusual conditions require it.
Any surcharge will be documented with photos in your service report.

## Notification

You will receive an email when each service is scheduled (with the expected
amount based on your last service) and again when the service is complete
and your card is charged (with the actual amount).

## Right to Cancel

You can cancel automatic charging any time by emailing diving@briancline.co.
Cancellation is effective immediately for any service not yet performed.

## Right to Dispute

Contact diving@briancline.co before initiating a chargeback. Most disputes
are resolved by refund or service redo.
`.trim(),
  },
};
