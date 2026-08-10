# Range-aware hull-cleaning checkout

## Problem

SailorSkills Pro deliberately omits a single `estimate` value when either bottom-paint age or time-since-cleaning is unknown. Its customer quote remains honest by presenting the calculated first-cleaning range without inventing a midpoint or worst-case estimate.

The briancline.co order page already renders that markerless range, but submission still coerces a missing `estimate` query parameter to `0`. The `create-payment-intent` edge function rejects `0` as `Invalid price calculation` before creating an order or Stripe SetupIntent. Avajogo reproduced this contract gap: a valid 25-foot powerboat range quote reached checkout without a point estimate and could not be submitted.

## Goals

- Allow a customer to complete card-on-file checkout when the honest quote is a range.
- Preserve the existing exact-estimate flow and all old exact links.
- Keep the server authoritative for pricing and reject tampered or stale quote values before any database or Stripe write.
- Store what the customer actually saw and authorized: exact price or minimum/maximum range.
- Keep unknown pricing inputs unknown; never synthesize a midpoint, minimum, or worst-case point estimate.
- Render range-aware confirmation and operator email content instead of `$0`.

## Non-goals

- No automatic charge at checkout; this remains a Stripe SetupIntent/card-on-file flow.
- No change to hull-cleaning rates, growth tiers, frequency semantics, anode pricing, promotions, or final post-service billing.
- No redesign of the estimator or field-capture UI.
- No merge, production schema migration, edge-function deploy, Vercel deploy, email, or SMS without Brian's separate approval at the applicable gate.

## Quote model

The checkout uses a discriminated quote shape:

```ts
type CheckoutQuote =
  | { mode: 'exact'; amountCents: number }
  | { mode: 'range'; minCents: number; maxCents: number };
```

All amounts are positive integers in cents. A range requires `minCents <= maxCents`. A degenerate range is normalized to an exact quote.

### Client derivation

The order page derives the submitted quote from its current, editable inputs:

- If both condition selectors produce a matrix prediction, use the live predicted amount as an exact quote. An unchanged valid URL estimate may remain the displayed marker, but it is not trusted for submission after inputs change.
- If either condition remains `Not sure`, use the existing estimate scale's minimum and maximum as a range quote.
- If boat length, service, frequency, or another required pricing input is invalid, checkout remains disabled and no quote is submitted.

This means existing Pro links that omit `estimate` need no new query parameters. They become valid range checkouts using the same values already displayed on the page.

### Server authority

The edge function receives the discriminated quote plus the pricing inputs. A pure shared pricing module recomputes the canonical exact quote or range from `business_pricing_config` and the validated service details.

Before any customer, boat, order, authorization, or Stripe write, the edge function:

1. validates the quote shape and pricing inputs;
2. recomputes the canonical quote;
3. requires the submitted quote to match the canonical quote to the cent; and
4. returns a specific refresh/retry message on mismatch.

The server never accepts client-provided prices merely because they fall inside a broad envelope. Flat-rate services continue through their exact-price path.

The frontend calculator and server module remain separate runtime implementations, but parity tests use literal scenarios to lock their shared contract, including Avajogo's `$150-$366` recurring range.

## Checkout and authorization UX

Exact quotes retain the existing wording. Range quotes display:

- `Estimated first-cleaning range: $MIN-$MAX`
- the existing explanation that actual growth determines the cleaning price;
- the existing disclosure that needed anodes are additional; and
- no `Our estimate` marker while condition data is unknown.

The charge-authorization paragraph repeats the range for range quotes. It does not call the maximum a cap because anodes can be added after inspection and are separately disclosed.

Validation errors never expose `Invalid price calculation` to the customer. A quote mismatch returns: `Pricing changed while this page was open. Please refresh and review the updated estimate.` No writes or Stripe objects may exist when this response is returned.

## Persistence

An additive migration in the SailorSkills Pro repository updates the shared production schema:

### `service_orders`

- add `estimate_mode text not null default 'exact'` with `exact|range` check;
- make `estimated_amount` nullable;
- add nullable `estimated_min_amount numeric` and `estimated_max_amount numeric`;
- add a check constraint requiring exactly one valid representation:
  - exact: `estimated_amount` is non-null and min/max are null;
  - range: `estimated_amount` is null and min/max are non-null with min <= max.

### `order_authorizations`

- add `quote_mode text not null default 'exact'` with `exact|range` check;
- make `quoted_price_cents` nullable;
- add nullable `quoted_min_cents integer` and `quoted_max_cents integer`;
- add the equivalent exact-versus-range check constraint.

`quote_snapshot` records the full discriminated quote and pricing inputs for both modes. `quoted_annualized_cents` remains populated only for exact recurring quotes; range annualized values live in the immutable snapshot unless a later reporting requirement justifies dedicated columns.

For range orders, `customer_services.base_price` remains null. No downstream billing path may interpret the range maximum as the amount to charge.

Stripe SetupIntent metadata uses `quote_mode` plus either `estimated_amount` or `estimated_min`/`estimated_max`. Stripe still receives no charge amount.

## Idempotency and downstream notifications

The two-minute duplicate-order lookup matches on customer, boat, service, and the complete quote representation:

- exact: `estimate_mode=exact` plus `estimated_amount`;
- range: `estimate_mode=range` plus both range columns.

Confirmation-email helpers accept `CheckoutQuote` and render either `$X estimated` or `$MIN-$MAX estimated range`. They must never coerce a nullable exact amount to zero. Existing operator SMS content does not include price and remains unchanged.

## Cross-repository responsibilities

### briancline.co

- derive and display `CheckoutQuote` from live form inputs;
- submit the discriminated quote;
- add the server pricing/validation module;
- update order creation, authorization, idempotency, Stripe metadata, and confirmation emails;
- add unit, contract, and checkout tests.

### SailorSkills Pro

- add the shared-schema migration;
- retain the current omit-`estimate` behavior for unknown conditions;
- add/adjust checkout-link contract coverage proving unknown conditions stay unknown and exact conditions still carry a point estimate.

## Test strategy

Implementation follows red-green-refactor.

1. Pure client quote tests:
   - known conditions produce an exact quote;
   - either unknown condition produces a literal min/max range;
   - invalid required input produces no quote;
   - changing a prefilled condition replaces a stale URL estimate.
2. Pure server validator tests:
   - Avajogo inputs validate as a `$150-$366` range;
   - exact and range tampering fail;
   - malformed/zero/reversed ranges fail;
   - flat-rate services remain exact.
3. Edge-function contract tests:
   - quote validation occurs before the first write or Stripe call;
   - exact and range idempotency filters use the correct columns;
   - SetupIntent metadata contains the correct representation.
4. Render/e2e tests:
   - an estimate-less Pro URL can reach submission with range wording;
   - exact links retain their current wording;
   - confirmation emails show a range and never `$0`.
5. Migration checks in disposable PostgreSQL:
   - existing exact rows satisfy the new defaults/constraint;
   - valid range rows insert;
   - mixed or incomplete representations are rejected.

## Release sequence and gates

1. Verify production migration history and choose a unique migration version.
2. Apply the additive/constraint migration to production only with Brian's explicit approval.
3. Deploy the backward-compatible edge function and webhook only with Brian's explicit approval.
4. Merge/deploy the briancline.co site only with Brian's explicit approval.
5. Verify the deployed source SHA, then run a non-charging browser checkout through SetupIntent confirmation using an approved test/customer path.
6. Confirm the created order and authorization preserve the range, Stripe created no charge, and confirmation content contains the range rather than `$0`.

Avajogo's existing production link has already been repaired independently with an exact `$366` estimate based on Brian's four-year paint-age assumption. That customer repair is not evidence that the general range path is released.
