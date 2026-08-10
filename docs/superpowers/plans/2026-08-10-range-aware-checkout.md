# Range-Aware Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers authorize card-on-file checkout from honest hull-cleaning price ranges while preserving exact quotes, server-authoritative pricing, and range-aware persistence and notifications.

**Architecture:** Introduce one discriminated quote contract at each runtime boundary. The browser derives an exact quote or range from current form inputs; the Supabase function independently rebuilds the canonical quote from validated inputs and pricing configuration before any write; the shared production schema stores exactly one representation; downstream confirmation helpers render that stored representation without coercing null to zero.

**Tech Stack:** React 19, Vite 6, Vitest 4, Supabase Edge Functions (Deno/TypeScript), PostgreSQL migrations, Stripe SetupIntents.

## Global Constraints

- Use red-green-refactor for every behavior change: first add a focused failing test, run it and observe the intended failure, then make the smallest implementation pass.
- Do not alter rates, growth tiers, recurrence semantics, promo behavior, automatic-charge behavior, or the Pro link rule that omits a point estimate when a condition is unknown.
- Keep browser and server calculators separate; assert parity with literal cases rather than importing browser code into the edge runtime.
- Validate the canonical quote before customer, boat, order, authorization, Stripe, promo, or other production writes.
- Do not merge, push, deploy, apply the production migration, write production data, or send a message during this implementation.
- Preserve unrelated work in both repositories. Implement only in the dedicated linked worktrees.

## Task 1: Add the Browser Quote Contract

**Files:**
- Create: `src/services/lib/checkout-quote.js`
- Create: `tests/checkout-quote.test.js`
- Modify: `src/services/lib/diving-calculator.js` only if a narrow export is needed

- [ ] Add failing tests for a pure `deriveCheckoutQuote` helper:

```js
expect(deriveCheckoutQuote({
  serviceKey: "cleaning",
  boatLength: "25",
  boatType: "powerboat",
  hullType: "monohull",
  frequency: "monthly",
  propellerCount: 1,
  paintAge: "",
  lastCleaned: "",
  anodeCount: 0,
})).toEqual({ mode: "range", minCents: 15000, maxCents: 36600 });
```

- [ ] Cover known Avajogo conditions (`2+yr`, `9-12`) as `{ mode: "exact", amountCents: 36600 }`.
- [ ] Cover either unknown condition, invalid length, unsupported service, exact flat-rate service, and a changed known condition that ignores a stale URL estimate.
- [ ] Run `npx vitest run tests/checkout-quote.test.js` and confirm failure because the helper does not exist.
- [ ] Implement `deriveCheckoutQuote` using `estimateScale` for cleaning and `calculateEstimate` for supported exact services. Round displayed dollars once with `Math.round(dollars) * 100`; normalize a degenerate range to exact.
- [ ] Rerun the focused test and existing calculator tests:

```bash
npx vitest run tests/checkout-quote.test.js tests/conditions-range.test.js tests/estimate-scale.test.js tests/estimate-scale-render.test.js
```

- [ ] Commit: `feat(checkout): derive exact and range quotes`

## Task 2: Wire Range Quotes Into the Order Page

**Files:**
- Modify: `src/services/pages/DivingOrder.jsx`
- Create: `tests/range-checkout-render.test.js`
- Modify: `tests/e2e/hull-cleaning-order.spec.js`

- [ ] Add a failing source/render contract test proving the order payload sends `quote`, never `estimate: estimateAmount || 0`, and range authorization wording includes the live minimum and maximum.
- [ ] Extend the Playwright test fixture for an estimate-less Pro URL and assert it displays `Estimated first-cleaning range: $150-$366`, retains no estimate marker, and enables submission after required fields and agreements are complete.
- [ ] Run the focused tests and confirm they fail on the exact-only payload/writing.
- [ ] Derive `checkoutQuote` from the current `conditionInputs`; require it in `canSubmit`; include it in `formData` and remove the zero fallback.
- [ ] Render exact or range summaries in the review card and charge-authorization paragraph. Keep existing exact wording for old links.
- [ ] Map the server's quote-mismatch response to `Pricing changed while this page was open. Please refresh and review the updated estimate.`
- [ ] Rerun:

```bash
npx vitest run tests/range-checkout-render.test.js tests/estimate-scale-render.test.js tests/order-marker.test.js
npx playwright test tests/e2e/hull-cleaning-order.spec.js
```

- [ ] Commit: `feat(checkout): submit and display range quotes`

## Task 3: Add a Pure Server Pricing Validator

**Files:**
- Create: `supabase/functions/_shared/checkout-quote.ts`
- Create: `tests/checkout-quote-server.test.ts`

- [ ] Add failing tests for quote-shape parsing and canonical calculation from literal pricing configuration.
- [ ] Assert Avajogo unknown conditions produce `{ mode: 'range', minCents: 15000, maxCents: 36600 }` and known four-year/9-12 conditions produce `{ mode: 'exact', amountCents: 36600 }`.
- [ ] Assert exact/range tampering, zero values, reversed ranges, unsupported matrix values, invalid length, and missing frequency fail.
- [ ] Assert flat-rate services remain exact and that browser/server literal cases match expected cents.
- [ ] Run `npx vitest run tests/checkout-quote-server.test.ts` and confirm failure because the server helper is absent.
- [ ] Implement exported `parseSubmittedQuote`, `calculateCanonicalQuote`, and `quotesEqual` functions. Port the pricing constants/matrix needed by the Deno runtime and allow DB config values to override their named defaults.
- [ ] Rerun the focused tests.
- [ ] Commit: `feat(checkout): validate canonical quotes server-side`

## Task 4: Make Order Creation Quote-Aware

**Files:**
- Modify: `supabase/functions/create-payment-intent/index.ts`
- Create: `tests/create-payment-intent-quote-contract.test.ts`
- Modify: `tests/checkout-authorization.test.ts` if present and relevant

- [ ] Add failing source-contract tests that require quote validation before the first `.from(...).upsert/insert/update`, range-aware idempotency filters, range-aware order and authorization columns, null range `customer_services.base_price`, and quote-aware Stripe metadata.
- [ ] Replace the broad `validatePrice` envelope with the pure canonical validator. Return the refresh/retry message with a stable `pricing_changed` code on mismatch.
- [ ] Project exact quotes to:

```ts
{
  estimate_mode: 'exact',
  estimated_amount: amountCents / 100,
  estimated_min_amount: null,
  estimated_max_amount: null,
}
```

- [ ] Project range quotes to the corresponding `range` mode, null exact amount, and dollar min/max columns.
- [ ] Apply the same discrimination to duplicate lookup filters, `order_authorizations`, immutable `quote_snapshot`, and SetupIntent metadata.
- [ ] Populate `quoted_annualized_cents` only for exact recurring quotes. Set `customer_services.base_price` to null for a range.
- [ ] Rerun:

```bash
npx vitest run tests/create-payment-intent-quote-contract.test.ts tests/checkout-quote-server.test.ts tests/boat-match.test.js
```

- [ ] Commit: `feat(checkout): persist range authorizations`

## Task 5: Add the Shared-Schema Migration in SailorSkills Pro

**Files:**
- Create in a fresh Pro linked worktree: `supabase/migrations/20260810200000_range_checkout_quotes.sql`
- Create or modify in that worktree: `scripts/range-checkout-migration.test.ts`
- Modify in that worktree: `package.json`

- [ ] Fetch `origin/main`, verify the chosen migration version does not exist locally, and query production migration history read-only before finalizing the filename. If occupied, choose the next unique timestamp.
- [ ] Create a fresh linked worktree and branch from verified `origin/main`; do not edit the dirty Pro root checkout.
- [ ] Add a failing migration contract test that requires additive mode/range columns, nullable legacy exact columns, mode checks, and exact-versus-range representation checks for both tables.
- [ ] Run the focused migration test and confirm it fails because the migration is absent.
- [ ] Write an idempotent-safe migration sequence that adds columns/defaults, drops `NOT NULL` from exact columns, adds named check constraints with `NOT VALID`, validates them, then removes any temporary defaults only if the design requires it.
- [ ] Ensure all existing exact rows remain valid through defaults/backfill semantics and no table rebuild is attempted.
- [ ] Rerun the migration contract test and the existing checkout-link contract test:

```bash
npx tsx scripts/range-checkout-migration.test.ts
npm run test:checkout-link
```

- [ ] Commit: `feat(checkout): store exact or range quotes`

## Task 6: Make Confirmation Emails Range-Aware

**Files:**
- Modify: `supabase/functions/diving-stripe-webhook/index.ts`
- Modify: `supabase/functions/send-confirmation-email/index.ts` if it independently formats order prices
- Modify: `tests/diving-stripe-webhook-contract.test.ts`
- Modify: `tests/new-order-notification.test.ts`

- [ ] Add failing tests for an exact stored quote and a stored `$150-$366` range. Assert neither path contains `$0` and the range path contains `estimated range`.
- [ ] Extend order selects to include mode and range columns.
- [ ] Add one pure stored-quote reader/formatter used by customer and operator email helpers. Do not use `Number(nullableAmount) || 0`.
- [ ] Rerun:

```bash
npm run test:new-order-notification
```

- [ ] Commit: `feat(checkout): render range quote confirmations`

## Task 7: Full Verification and Release Handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-range-aware-checkout.md` to check completed steps
- Create if useful: `docs/range-checkout-release-handoff.md`

- [ ] Run the briancline.co focused suite, then full unit suite and production build:

```bash
npm test
npm run build
```

- [ ] Run the Pro migration and checkout-link tests, type-check, and relevant broader checks:

```bash
npx tsx scripts/range-checkout-migration.test.ts
npm run test:checkout-link
npx --no-install tsc --noEmit
```

- [ ] Run `git diff --check`, review both full diffs, and verify no unrelated files, secrets, deployment metadata, or production mutations are present.
- [ ] Record the two branch names, worktree paths, commit SHAs, test outputs, production rollout order, rollback notes, and the known affected-link audit (Avajogo repaired; Imagine sent but unclicked; no zero-dollar order/authorization rows).
- [ ] Stop before push, PR, merge, production migration, edge deployment, Vercel deployment, live checkout, or sending customer outreach. Present each as a separate explicit approval gate.
