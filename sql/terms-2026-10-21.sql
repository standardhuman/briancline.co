-- Terms of Service / Recurring Charge Authorization, version 2026-10-21
--
-- Companion to src/services/pages/legal/terms-content.js. Every version keyed
-- in that file MUST also exist as a terms_documents row so order_authorizations
-- can prove exactly what a customer saw at consent time.
--
-- This version adds section 8, "Payment Terms" (late charge, service pause on
-- balances past due, reversal/chargeback cost recovery) and renumbers the
-- sections that followed. The Recurring Charge Authorization text is unchanged;
-- it gets a 2026-10-21 row only to keep the two documents in lockstep.
--
-- Target: the shared Supabase project that backs briancline.co checkout
-- (public.terms_documents, created by 20260429_chargeback_hardening.sql).
--
-- Idempotent: each insert is guarded on (version, document_type), which is also
-- the table's unique key. Safe to re-run. No existing row is modified.
--
-- PLACEHOLDER PENDING ATTORNEY REVIEW. Do not scale beyond the existing
-- customer base on this text alone.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- tos
-- ─────────────────────────────────────────────────────────────────────────
insert into public.terms_documents (version, document_type, content_md, effective_at)
select
  '2026-10-21',
  'tos',
  $md$# SailorSkills Terms of Service

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
$md$,
  timestamptz '2026-10-21 00:00:00-07'
where not exists (
  select 1
  from public.terms_documents
  where version = '2026-10-21'
    and document_type = 'tos'
);

-- ─────────────────────────────────────────────────────────────────────────
-- recurring_authorization
-- ─────────────────────────────────────────────────────────────────────────
insert into public.terms_documents (version, document_type, content_md, effective_at)
select
  '2026-10-21',
  'recurring_authorization',
  $md$# Recurring Charge Authorization

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
$md$,
  timestamptz '2026-10-21 00:00:00-07'
where not exists (
  select 1
  from public.terms_documents
  where version = '2026-10-21'
    and document_type = 'recurring_authorization'
);

commit;

-- Verify:
--   select version, document_type, effective_at, length(content_md)
--   from public.terms_documents
--   where version = '2026-10-21';
