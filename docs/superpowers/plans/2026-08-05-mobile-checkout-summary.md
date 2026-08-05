# Mobile Checkout Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant boat-summary card from mobile checkout while preserving the quoted estimate and the existing sticky desktop summary.

**Architecture:** Keep `ProfileCard` and the existing desktop sidebar intact. Delete only the separate mobile-only render, with a Playwright regression test covering both sides of the existing Tailwind `lg` breakpoint.

**Tech Stack:** React, Tailwind CSS responsive utilities, Playwright.

## Global Constraints

- Below the Tailwind `lg` breakpoint, do not render a visible profile card.
- At `lg` and wider, keep the existing sticky sidebar unchanged.
- Keep the quoted estimate visible on mobile.
- Do not change checkout data, pricing, validation, provider routing, payment behavior, or submission behavior.
- Do not submit an order during verification.
- Push, PR, merge, and deployment remain outside this local implementation plan.

---

### Task 1: Make the checkout summary desktop-only

**Files:**
- Modify: `tests/e2e/hull-cleaning-order.spec.js`
- Modify: `src/services/pages/DivingOrder.jsx:699-710`

**Interfaces:**
- Consumes: the existing `/hull-cleaning/order` query-string contract and Tailwind `lg` breakpoint.
- Produces: a checkout that shows no visible `Your Boat` heading at 390×844, preserves `Estimated cost: $217`, and shows the existing `Your Boat` sidebar at 1280×900.

- [ ] **Step 1: Write the failing responsive browser test**

Add this test inside `test.describe('Hull Cleaning Order Form', ...)`:

```js
test('shows the profile card only beside the form on desktop', async ({ page }) => {
  const checkoutUrl = `${ORDER_BASE}?service=cleaning&length=35&type=sailboat&hull=monohull&frequency=quarterly&estimate=217&propellers=1&paintAge=%3C6mo&lastCleaned=7-8&anodes=0`;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(checkoutUrl);
  await page.waitForSelector('text=Schedule');

  await expect(page.getByText('Estimated cost: $217', { exact: true })).toBeVisible();
  await expect(page.locator('h3:visible').filter({ hasText: 'Your Boat' })).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('h3:visible').filter({ hasText: 'Your Boat' })).toHaveCount(1);
});
```

This exercises rendering only; it does not fill fields, click authorization, call the payment function, or submit the form.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx playwright test tests/e2e/hull-cleaning-order.spec.js --grep "shows the profile card only beside the form on desktop"
```

Expected: FAIL at the mobile assertion because the current `lg:hidden` wrapper makes one `Your Boat` heading visible at 390px.

- [ ] **Step 3: Remove only the mobile profile-card render**

Delete this block from `DivingOrder.jsx`:

```jsx
{/* Mobile: Profile card at top */}
<div className="lg:hidden mb-6">
  <ProfileCard
    form={form}
    service={service}
    estimateAmount={estimateAmount}
    isItemRecovery={isItemRecovery}
    showFrequency={showFrequency}
  />
</div>
```

Do not modify the later `lg:col-span-2 hidden lg:block` sidebar.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx playwright test tests/e2e/hull-cleaning-order.spec.js --grep "shows the profile card only beside the form on desktop"
```

Expected: PASS, with the mobile estimate visible, zero visible profile headings at 390px, and one visible profile heading at 1280px.

- [ ] **Step 5: Run regression verification**

Run:

```bash
npx vitest run
npm run build
git diff --check
```

Expected: 154 unit tests pass, the Vite/prerender build succeeds for all eight routes, and `git diff --check` prints no output.

- [ ] **Step 6: Commit the local implementation**

```bash
git add tests/e2e/hull-cleaning-order.spec.js src/services/pages/DivingOrder.jsx docs/superpowers/plans/2026-08-05-mobile-checkout-summary.md
git commit -m "fix(checkout): hide boat summary on mobile"
```
