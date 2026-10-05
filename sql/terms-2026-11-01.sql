-- Terms of Service / Recurring Charge Authorization, version 2026-11-01
--
-- Companion to src/services/pages/legal/terms-content.js. Every version keyed
-- in that file MUST also exist as a terms_documents row so order_authorizations
-- can prove exactly what a customer saw at consent time.
--
-- Generated from terms-content.js: each content_md below is byte-identical to
-- the module body (tests/legal-document-version.test.js enforces this). The
-- closing dollar-quote follows the last character of the text directly, so no
-- trailing newline is stored.
--
-- What changed vs 2026-10-21 (both documents rewritten in plain language):
--   - Contracting party is Sailor Skills, LLC, doing business as Brian Cline
--     Diving & Hull Cleaning (was "SailorSkills (Brian Cline, sole proprietor)").
--   - Liability section reworded.
--   - Late payments: simple interest at 10% per year (replaces 1.5% per month
--     or $25, whichever is greater).
--   - One cancellation rule across both documents, including the online
--     "Cancel my plan" link in service emails (email still works).
--   - Diver discretion to postpone or stop work for safety or conditions.
--   - Inspections are visual only.
--   - Boat condition responsibilities.
--   - Consent to electronic records and notices.
--   - How changes to the terms are made and noticed.
--   - Standard boilerplate (governing law, severability, entire agreement, etc.).
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
  '2026-11-01',
  'tos',
  $md$# Brian Cline Diving & Hull Cleaning Terms of Service

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
you.$md$,
  timestamptz '2026-11-01 00:00:00-07'
where not exists (
  select 1
  from public.terms_documents
  where version = '2026-11-01'
    and document_type = 'tos'
);

-- ─────────────────────────────────────────────────────────────────────────
-- recurring_authorization
-- ─────────────────────────────────────────────────────────────────────────
insert into public.terms_documents (version, document_type, content_md, effective_at)
select
  '2026-11-01',
  'recurring_authorization',
  $md$# Recurring Charge Authorization

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

The Terms of Service also apply to your plan.$md$,
  timestamptz '2026-11-01 00:00:00-07'
where not exists (
  select 1
  from public.terms_documents
  where version = '2026-11-01'
    and document_type = 'recurring_authorization'
);

commit;

-- Verify:
--   select version, document_type, effective_at, length(content_md)
--   from public.terms_documents
--   where version = '2026-11-01';
