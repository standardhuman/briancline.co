// Canonical legal text for briancline.co. Each version here MUST also exist
// as a row in the terms_documents table (created by SailorSkills Pro migration
// 20260514_legacy_form_tables_plus_chargeback_hardening.sql). Checkout's
// create-payment-intent rejects any termsVersion without a matching row, so the
// row must be in the database BEFORE ACTIVE_VERSION points at it in production.
// When you ship a new version: add a new keyed entry below AND insert a matching
// terms_documents row (sql/terms-<version>.sql + a Pro migration), then bump
// ACTIVE_VERSION below. Never edit a published version; add a new one.
//
// PLACEHOLDER PENDING ATTORNEY REVIEW. Do not scale beyond the existing customer
// base on this text alone.

export const ACTIVE_VERSION = "2026-11-01";

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
  "2026-10-21": {
    effectiveDate: "October 21, 2026",
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

## 8. Payment Terms

Invoices are due upon receipt. Balances unpaid 30 days after the invoice
date accrue a late charge of 1.5% per month (18% per year) or $25, whichever
is greater, until paid. I may pause scheduled service on any boat with a
balance more than 30 days past due and resume once it is current. If a
payment is reversed or disputed with your bank, you remain responsible for
the amount, any bank fee I am charged for the reversal, and reasonable
collection costs. Cards saved on file are charged at the time of each
service, so this section applies mainly to invoices paid by link, check, or
other offline methods.

## 9. Dispute Resolution

You agree to contact diving@briancline.co before initiating a credit-card
chargeback or legal action. Disputes are governed by California law and
venue is Alameda County.

## 10. Liability

Our liability is limited to the amount paid for the service in question.
SailorSkills carries marine-services liability insurance; certificates
available on request.

## 11. Photo and Video Use

We capture photos and video of services for your service log. We will not
use them for marketing without separate written permission.

## 12. Force Majeure

If weather, marina access, or other conditions outside our control prevent
service, we will reschedule at no charge.

## 13. Data Retention

Service records, photos, consent artifacts, and charge records are retained
for at least 7 years for tax and dispute-defense purposes.
`.trim(),
  },
  "2026-11-01": {
    effectiveDate: "November 1, 2026",
    body: `
# Brian Cline Diving & Hull Cleaning Terms of Service

## 1. Who We Are

These terms are an agreement between you and Sailor Skills, LLC, a
California limited liability company doing business as Brian Cline Diving &
Hull Cleaning ("we" or "us"). You can reach us at diving@briancline.co.

## 2. Accepting These Terms

You accept these terms when you check the box at checkout and click
"Authorize & Save Card", or when you pay an invoice that links to them. Your
typed name and click count as your electronic signature under the federal
E-SIGN Act and the California Uniform Electronic Transactions Act.

## 3. Electronic Records and Notices

You agree to receive these terms, service reports, receipts, charge notices
and other notices by email or on our website. You need an email account and
a web browser to receive them. You can ask for a paper copy at no charge, or
withdraw this consent, by emailing diving@briancline.co. Withdrawing consent
ends automatic charging. Please keep your email address current with us.

## 4. Services

We provide underwater hull cleaning, diver inspections, zinc anode
replacement, propeller service and item recovery at Berkeley Marina and
other San Francisco Bay Area marinas we agree to serve. The work may be done
by Brian Cline or by a qualified diver we send. Either way, we are
responsible to you for it.

## 5. Inspections Are Visual

Inspection notes, photos and video describe what our diver could see
underwater that day, limited by visibility and conditions. They are not a
marine survey, an engineering assessment, or an opinion that your boat is
seaworthy. For insurance, purchase or repair decisions, use a licensed
marine surveyor.

## 6. Your Boat's Condition

Cleaning removes growth, and some antifouling paint comes off with it,
especially ablative or aging paint. That is normal and is not damage. We are
not responsible for conditions that existed before our service, including
worn or failing paint, blisters, corrosion, loose or failing through-hulls,
transducers or fittings, and earlier damage. If we see a problem, we will
note it in your service report. We do not repair anything unless you ask us
to and agree to the price.

## 7. Your Responsibilities

You confirm that you own the boat or are authorized to order work on it.
You agree to:

- give us an accurate marina, slip and boat description, and tell us before the service window if the boat moves;
- make sure we can reach the boat, including any gate or dock access the marina requires;
- keep engines off and propellers secured while we work, and turn off shore power if we ask;
- tell us about any hazard you know of, such as electrical faults, damaged fittings or fouled lines.

If we can't reach or safely work on the boat because of something within
your control, we will reschedule. If it keeps happening, we may end
recurring service.

## 8. Diver Safety and Conditions

Our diver may delay, stop or decline any dive for safety reasons, including
strong current, low visibility, stray electrical current, water-quality
advisories, marine life or weather. If we can't perform a service for these
reasons, or for others outside our control such as a marina closure, we
will reschedule at no charge. You are never charged for work we did not
perform.

## 9. Prices and Estimates

Your estimate at order time is based on boat length, service frequency and
normal conditions. The actual price can be higher when:

- growth is heavier than expected (+50% to +100%, and up to +200% in rare, extreme cases);
- anodes need replacing (priced per anode);
- unusual conditions take extra time.

We photograph and document any surcharge in your service report. We will
contact you before charging more than double your estimate. Prices do not
include any tax that may apply.

## 10. Payment

You authorize us to charge the card you save at checkout for each service
you order, in the amount shown in that service's report. Cards are charged
when the service is complete. If you choose a recurring plan, the Recurring
Charge Authorization also applies.

Invoices paid another way are due on receipt. A balance unpaid 30 days after
the invoice date accrues simple interest at 10% per year until paid, and we
may pause service on that boat until it is current. If you dispute a charge
with your bank and the dispute is decided in our favor, you still owe the
amount.

## 11. Cancelling

**A single visit.** Tell us at least 24 hours before the service window, by
replying to any service email or emailing diving@briancline.co. If you can't
give 24 hours' notice, tell us anyway. There is no fee.

**A recurring plan.** Cancel any time online, using the "Cancel my plan"
link in any service email, or by emailing diving@briancline.co. Cancelling
ends the plan for that boat and takes effect right away for any service not
yet performed. You still owe for services already performed.

**On our side.** We may end service by emailing you. You owe only for work
already done.

## 12. Redo or Refund

If a service was not performed as described in your order or service
report, email diving@briancline.co within 14 days of the service report
date. We will redo the affected work at no charge. If a redo isn't practical
or doesn't fix the problem, we will refund the charge for that service.
Refunds usually post within 5 to 10 business days. Growth that returns after
a cleaning is normal and is not covered, and neither are the conditions in
section 6.

## 13. Damage and Liability

If our negligence damages your boat while we are working on it, we are
responsible for that damage as the law provides. Please tell us in writing
within 30 days of the service, or as soon as you notice the damage, and give
us a chance to inspect it before it is repaired, except in an emergency. We
carry marine liability insurance, and a certificate is available on request.

To the extent the law allows, we are not liable for indirect or
consequential losses such as loss of use, missed races or charters, or lost
income. Nothing in these terms limits our liability for gross negligence,
willful misconduct, fraud, or anything else California law does not allow a
business to limit.

## 14. Photos, Video and Records

We take photos and video (which may include incidental audio) for your
service report. We won't use them in marketing without your written
permission. We keep service records, photos, authorization records and
charge records for 7 years for tax and dispute purposes, then delete them.
You can ask us to delete anything we are not required to keep.

## 15. Questions and Disputes

If something goes wrong, please email diving@briancline.co first. Most
problems are fixed fastest that way, and we will reply within 5 business
days. This does not limit your rights with your card issuer or under the
law. These terms are governed by California law. Disputes go to the courts
of Alameda County, and either of us may use small claims court.

## 16. Changes to These Terms

We may update these terms. The version you accepted applies to your
services until you accept a newer one. We will email you about any change
that affects you, and ask you to accept it at your next order or invoice
payment before it applies to you.

## 17. General

These terms, your order, and the Recurring Charge Authorization (if you have
a plan) are the whole agreement. If they conflict, these terms control. If
any part is found unenforceable, the rest still applies. We may transfer
this agreement to a business that takes over our services, with notice to
you.
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
  "2026-10-21": {
    effectiveDate: "October 21, 2026",
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
  "2026-11-01": {
    effectiveDate: "November 1, 2026",
    body: `
# Recurring Charge Authorization

By choosing a recurring service plan and saving your card, you authorize
Sailor Skills, LLC, doing business as Brian Cline Diving & Hull Cleaning, to
charge that card for each scheduled service until you cancel.

## What Renews

Service on the schedule you picked: every 1, 2, 3 or 6 months. The plan has
no end date. It continues until you or we cancel it.

## How Much

Each charge is based on your boat length and the per-foot rate quoted at
order time, as documented in that visit's service report. It can be higher
for heavy growth (+50% to +100%, and up to +200% in rare, extreme cases),
anode replacement, or unusual conditions. Every surcharge is photographed
and documented, and we will contact you before charging more than double
your estimate. If our base rate changes, we will email you at least 14 days
before the new rate applies.

## When You're Charged

Your card is charged after each service is complete. We usually email you
before each service. You will always get a receipt with the actual amount
when your card is charged.

## How to Cancel

Any time online, using the "Cancel my plan" link in any service email. You
can also email diving@briancline.co or reply to any service email.
Cancelling ends the plan for that boat and takes effect right away for any
service not yet performed.

## Questions About a Charge

Email diving@briancline.co. We resolve most issues with a redo or a refund.
This does not limit your rights with your card issuer.

The Terms of Service also apply to your plan.
`.trim(),
  },
};
