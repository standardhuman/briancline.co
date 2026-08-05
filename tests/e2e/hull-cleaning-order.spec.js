/**
 * E2E tests for the Hull Cleaning order flow.
 * Tests the calculator UI, form submission, and Stripe payment in test mode.
 */
import { test, expect } from '@playwright/test';

const BASE = '/hull-cleaning';
const ORDER_BASE = '/hull-cleaning/order';

// Test card numbers for Stripe test mode
const STRIPE_TEST_CARD = '4242424242424242';
const STRIPE_TEST_EXP = '12/30';
const STRIPE_TEST_CVC = '123';

// ── Helper: locate the Service Type card area ──
function serviceTypeArea(page) {
  return page.locator('[class*="CardContent"]').filter({ hasText: 'Service Type' }).first();
}

// ── Calculator UI Tests ──

test.describe('Hull Cleaning Calculator UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('text=Diving Services Estimator');
  });

  test('should display all service type options', async ({ page }) => {
    // Use exact: true to avoid matching substrings / overlapping text
    await expect(page.getByRole('button', { name: 'Cleaning & Anodes Hull', exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inspection', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Item Recovery', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Propeller Service', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anodes Only', exact: true })).toBeVisible();
  });

  test('should show/hide input cards based on service type', async ({ page }) => {
    // Cleaning should show all cards
    await expect(page.getByRole('heading', { name: 'Boat Length' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Boat Type' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Service Frequency' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Propellers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bottom Paint Age' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Last Cleaned' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Anode Service' })).toBeVisible();

    // Switch to Item Recovery — should hide all
    await page.getByRole('button', { name: 'Item Recovery', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Boat Length' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Boat Type' })).not.toBeVisible();

    // Switch to Propeller Service — should show only propellers
    await page.getByRole('button', { name: 'Propeller Service', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Propellers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Boat Length' })).not.toBeVisible();
  });

  test('should calculate estimate for default cleaning config', async ({ page }) => {
    // Default: 35ft sailboat, monthly, monohull, 1 propeller, <6mo paint, <2 last cleaned
    const estimateCard = page.getByText('Your Estimate').first();
    await expect(estimateCard).toBeVisible();

    // Should show a dollar amount
    const totalText = page.locator('.text-5xl').first();
    await expect(totalText).toBeVisible();
    const total = await totalText.textContent();
    expect(total).toMatch(/\$/);
  });

  test('should update estimate when changing boat length', async ({ page }) => {
    const totalEl = page.locator('.text-5xl').first();
    const initialTotal = await totalEl.textContent();

    // Change boat length to 50
    const lengthInput = page.locator('input[type="number"]').first();
    await lengthInput.fill('50');

    // Wait for estimate to update
    await page.waitForTimeout(200);
    const newTotal = await totalEl.textContent();

    // 50ft should cost more than 35ft
    const parsePrice = (s) => parseFloat(s.replace(/[^0-9.]/g, ''));
    expect(parsePrice(newTotal)).toBeGreaterThan(parsePrice(initialTotal));
  });

  test('should show powerboat surcharge when powerboat selected', async ({ page }) => {
    // Select powerboat (in the Boat Type card, not service type)
    await page.getByRole('button', { name: 'Powerboat', exact: true }).first().click();
    await expect(page.getByText('Powerboat surcharge')).toBeVisible();
  });

  test('should show catamaran surcharge', async ({ page }) => {
    await page.getByRole('button', { name: 'Catamaran', exact: true }).click();
    await expect(page.getByText('Catamaran surcharge')).toBeVisible();
  });

  test('should show trimaran surcharge', async ({ page }) => {
    await page.getByRole('button', { name: 'Trimaran', exact: true }).click();
    await expect(page.getByText('Trimaran surcharge')).toBeVisible();
  });

  test('should show growth surcharge for poor conditions', async ({ page }) => {
    // Click "2+ years" for paint age (first one)
    await page.getByText('2+ years', { exact: true }).first().click();
    // Click "2+ years" for last cleaned (second one, same text)
    await page.getByText('2+ years', { exact: true }).last().click();
    await expect(page.getByText('Est. growth').first()).toBeVisible();
  });

  test('should show propeller surcharge for multiple propellers', async ({ page }) => {
    // Find the propellers card and click "2"
    const propSection = page.getByRole('heading', { name: 'Propellers' }).locator('..').locator('..');
    await propSection.getByText('2', { exact: true }).click();
    // Check in the estimate card (right side)
    await expect(page.getByText('Additional propeller', { exact: true })).toBeVisible();
  });

  test('should add anode costs', async ({ page }) => {
    // Click the + button for anodes 3 times
    const anodeSection = page.getByRole('heading', { name: 'Anode Service' }).locator('..').locator('..');
    const plusBtn = anodeSection.getByText('+');
    await plusBtn.click();
    await plusBtn.click();
    await plusBtn.click();

    // Check in the estimate card
    await expect(page.getByText('Anode installation', { exact: true })).toBeVisible();
    await expect(page.getByText('3 × $15')).toBeVisible();
  });

  test('should show different rate for one-time vs recurring', async ({ page }) => {
    const totalEl = page.locator('.text-5xl').first();

    // Monthly (recurring)
    const monthlyTotal = await totalEl.textContent();
    await expect(page.getByText('per service')).toBeVisible();

    // Switch to One-Time (in the frequency card)
    await page.getByRole('button', { name: 'One-Time Single service' }).click();
    await page.waitForTimeout(200);
    const onetimeTotal = await totalEl.textContent();
    await expect(page.getByText('one-time service', { exact: true })).toBeVisible();

    // One-time should be more expensive
    const parsePrice = (s) => parseFloat(s.replace(/[^0-9.]/g, ''));
    expect(parsePrice(onetimeTotal)).toBeGreaterThan(parsePrice(monthlyTotal));
  });

  test('item recovery should show flat $199', async ({ page }) => {
    await page.getByRole('button', { name: 'Item Recovery', exact: true }).click();
    await page.waitForTimeout(200);
    const totalEl = page.locator('.text-5xl').first();
    const total = await totalEl.textContent();
    expect(total).toContain('199');
  });

  test('propeller service should charge per propeller', async ({ page }) => {
    await page.getByRole('button', { name: 'Propeller Service', exact: true }).click();
    await page.waitForTimeout(200);
    const totalEl = page.locator('.text-5xl').first();
    const total = await totalEl.textContent();
    expect(total).toContain('349');
  });
});

// ── Order Form Tests ──
// Note: The order form lives at /hull-cleaning/order which is served via
// React Router inside the services SPA. Direct navigation works in production
// via Vercel rewrites. In dev mode, the Vite middleware handles it.

test.describe('Hull Cleaning Order Form', () => {
  test('should pre-fill form from URL params', async ({ page }) => {
    await page.goto(`${ORDER_BASE}?service=cleaning&length=42&type=powerboat&hull=catamaran&frequency=monthly&estimate=250`);
    await page.waitForSelector('text=Schedule');

    // Check length is pre-filled
    const lengthInput = page.locator('input[placeholder="40"]');
    await expect(lengthInput).toHaveValue('42');

    // Check estimated cost is shown
    await expect(page.getByText('Estimated cost: $250')).toBeVisible();
  });

  test('should pre-fill boat + owner contact fields from the field-capture link', async ({ page }) => {
    // The Pro capture link carries boatName + customerName/Email/Phone; the
    // customer should not have to retype them (all remain editable).
    await page.goto(`${ORDER_BASE}?service=cleaning&length=38&type=sailboat&hull=monohull&frequency=monthly&estimate=171&boatName=Serenity&customerName=Dana%20Reeves&customerEmail=dana%40example.com&customerPhone=%28510%29%20555-8899`);
    await page.waitForSelector('text=Schedule');

    await expect(page.locator('input[placeholder="Sea Spirit"]')).toHaveValue('Serenity');
    await expect(page.locator('input[placeholder="John Smith"]')).toHaveValue('Dana Reeves');
    await expect(page.locator('input[placeholder="john@example.com"]')).toHaveValue('dana@example.com');
    await expect(page.locator('input[placeholder="(510) 555-1234"]')).toHaveValue('(510) 555-8899');
  });

  test('with no capture params: boat + owner contact fields start empty', async ({ page }) => {
    // Organic visitor / old link with no boatName or customer* params — the
    // contact fields must not be pre-populated from anything.
    await page.goto(`${ORDER_BASE}?service=cleaning&length=35&type=sailboat&hull=monohull&frequency=monthly&estimate=157`);
    await page.waitForSelector('text=Schedule');

    await expect(page.locator('input[placeholder="Sea Spirit"]')).toHaveValue('');
    await expect(page.locator('input[placeholder="John Smith"]')).toHaveValue('');
    await expect(page.locator('input[placeholder="john@example.com"]')).toHaveValue('');
    await expect(page.locator('input[placeholder="(510) 555-1234"]')).toHaveValue('');
  });

  test('should display all form sections', async ({ page }) => {
    await page.goto(`${ORDER_BASE}?service=cleaning&length=35&type=sailboat&frequency=monthly&estimate=157`);
    await page.waitForSelector('text=Schedule');

    await expect(page.getByText('Boat Details')).toBeVisible();
    await expect(page.getByText('Boat Location')).toBeVisible();
    await expect(page.getByText('Your Information')).toBeVisible();
    await expect(page.getByText('Service Details')).toBeVisible();
    await expect(page.getByText('Payment Information')).toBeVisible();
  });

  test('should require mandatory fields before submit', async ({ page }) => {
    await page.goto(`${ORDER_BASE}?service=cleaning&length=35&type=sailboat&frequency=monthly&estimate=157`);
    await page.waitForSelector('text=Schedule');

    const submitBtn = page.getByText('Complete Order');
    await expect(submitBtn).toBeDisabled();
  });

  test('should render the estimate scale with our quoted number when the field-capture link carries conditions', async ({ page }) => {
    // The prefilled checkout link the field flow builds: paint + last-cleaned +
    // the estimate we texted. The scale should mark that estimate.
    await page.goto(`${ORDER_BASE}?service=cleaning&length=42&type=sailboat&hull=monohull&frequency=monthly&estimate=284&paintAge=1.5-2yr&lastCleaned=13-24`);
    await page.waitForSelector('text=Schedule');

    const scale = page.getByTestId('estimate-scale');
    await expect(scale).toBeVisible();
    await expect(scale.getByText(/Our estimate: \$284/)).toBeVisible();
    await expect(scale.getByText(/minimal growth/)).toBeVisible();
    await expect(scale.getByText(/severe growth/)).toBeVisible();
  });

  test('should render the scale with a local-prediction marker when conditions are present but no estimate param', async ({ page }) => {
    await page.goto(`${ORDER_BASE}?service=cleaning&length=42&type=sailboat&hull=monohull&frequency=monthly&paintAge=1.5-2yr&lastCleaned=13-24`);
    await page.waitForSelector('text=Schedule');

    const scale = page.getByTestId('estimate-scale');
    await expect(scale).toBeVisible();
    // No estimate param => marker uses the local matrix prediction ($378 here).
    await expect(scale.getByText(/Our estimate:/)).toBeVisible();
  });

  test('should render the scale with NO marker when conditions AND estimate are both unknown', async ({ page }) => {
    await page.goto(`${ORDER_BASE}?service=cleaning&length=42&type=sailboat&hull=monohull&frequency=monthly`);
    await page.waitForSelector('text=Schedule');

    const scale = page.getByTestId('estimate-scale');
    await expect(scale).toBeVisible();
    // No estimate param AND no paint/cleaning => the bar shows the span with no
    // "our estimate" marker (no local-prediction fallback from nothing).
    await expect(scale.getByText(/Our estimate:/)).toHaveCount(0);
    await expect(scale.getByText(/minimal growth/)).toBeVisible();
  });

  test('with NO frequency param: nothing preselected, must choose, badge + reassurance shown', async ({ page }) => {
    await page.goto(`${ORDER_BASE}?service=cleaning&length=42&type=sailboat&hull=monohull&estimate=189`);
    await page.waitForSelector('text=Schedule');

    // No frequency button is preselected (no silent monthly default).
    const freqButtons = page.getByRole('button').filter({ hasText: /^(Monthly|Every 2 Months|Every 3 Months|One-Time)$/ });
    await expect(freqButtons).toHaveCount(4);
    // "Most popular" badge on the bi-monthly option, and the unsure reassurance.
    await expect(page.getByText('Most popular')).toBeVisible();
    await expect(page.getByText('We can start at two months and evaluate after the first service.')).toBeVisible();

    // Submit is blocked and the missing-fields callout names the frequency.
    await expect(page.getByRole('button', { name: /Authorize & Save Card/ })).toBeDisabled();
    await expect(page.getByText('Service frequency')).toBeVisible();

    // Choosing a frequency clears the reassurance and the missing-field entry.
    await page.getByRole('button', { name: 'Every 2 Months', exact: true }).click();
    await expect(page.getByText('We can start at two months and evaluate after the first service.')).toHaveCount(0);
    await expect(page.getByText('Service frequency')).toHaveCount(0);
  });

  test('customer-editable condition selects: default to "Not sure", no marker', async ({ page }) => {
    await page.goto(`${ORDER_BASE}?service=cleaning&length=42&type=sailboat&hull=monohull&frequency=monthly`);
    await page.waitForSelector('text=Schedule');

    // Both selects render and default to "Not sure" (empty value) with no params.
    const paint = page.getByTestId('paint-age-select');
    const cleaned = page.getByTestId('last-cleaned-select');
    await expect(paint).toBeVisible();
    await expect(cleaned).toBeVisible();
    await expect(paint).toHaveValue('');
    await expect(cleaned).toHaveValue('');

    // No conditions + no estimate param ⇒ markerless full span (#17 behavior).
    const scale = page.getByTestId('estimate-scale');
    await expect(scale).toBeVisible();
    await expect(scale.getByText(/Our estimate:/)).toHaveCount(0);
  });

  test('selecting paint + last-cleaned narrows the estimate and shows a marker', async ({ page }) => {
    await page.goto(`${ORDER_BASE}?service=cleaning&length=42&type=sailboat&hull=monohull&frequency=monthly`);
    await page.waitForSelector('text=Schedule');

    const scale = page.getByTestId('estimate-scale');
    await expect(scale.getByText(/Our estimate:/)).toHaveCount(0);

    // Customer picks their hull condition — the local-prediction marker appears.
    await page.getByTestId('paint-age-select').selectOption('1.5-2yr');
    await page.getByTestId('last-cleaned-select').selectOption('13-24');
    await expect(scale.getByText(/Our estimate:/)).toBeVisible();

    // Clearing back to "Not sure" removes the marker again.
    await page.getByTestId('paint-age-select').selectOption('');
    await expect(scale.getByText(/Our estimate:/)).toHaveCount(0);
  });

  test('marker follows the selects even when a quoted estimate param is present (regression)', async ({ page }) => {
    // Brian's live repro: capture link with NO condition params but a quoted
    // estimate equal to the light-growth minimum ($189 on a 42' sail monohull).
    // The static quote used to win the marker forever, pinning "$189.00" at the
    // far left while the selects moved the bar around it.
    await page.goto(`${ORDER_BASE}?service=cleaning&length=42&type=sailboat&hull=monohull&frequency=monthly&estimate=189`);
    await page.waitForSelector('text=Schedule');

    const scale = page.getByTestId('estimate-scale');
    // No conditions yet ⇒ no marker (never the pinned $189 pill).
    await expect(scale.getByText(/Our estimate:/)).toHaveCount(0);

    // Customer picks 1-1.5yr / 9-12 => Heavy => $283.50 (the LIVE prediction),
    // NOT the $189 quote.
    await page.getByTestId('paint-age-select').selectOption('1-1.5yr');
    await page.getByTestId('last-cleaned-select').selectOption('9-12');
    await expect(scale.getByText(/Our estimate: \$283\.50/)).toBeVisible();
    await expect(scale.getByText(/Our estimate: \$189\.00/)).toHaveCount(0);

    // Clearing paint back to "Not sure" removes the marker (no $189 pill returns).
    await page.getByTestId('paint-age-select').selectOption('');
    await expect(scale.getByText(/Our estimate:/)).toHaveCount(0);
  });

  test('condition selects prefill from URL params (field-capture handoff)', async ({ page }) => {
    await page.goto(`${ORDER_BASE}?service=cleaning&length=42&type=sailboat&hull=monohull&frequency=monthly&paintAge=2%2Byr&lastCleaned=24%2B`);
    await page.waitForSelector('text=Schedule');

    await expect(page.getByTestId('paint-age-select')).toHaveValue('2+yr');
    await expect(page.getByTestId('last-cleaned-select')).toHaveValue('24+');
    // Prefilled conditions ⇒ a local-prediction marker is shown.
    await expect(page.getByTestId('estimate-scale').getByText(/Our estimate:/)).toBeVisible();
  });

  test('with a frequency param: that option is preselected, badge still shown', async ({ page }) => {
    await page.goto(`${ORDER_BASE}?service=cleaning&length=42&type=sailboat&hull=monohull&frequency=monthly&estimate=189`);
    await page.waitForSelector('text=Schedule');

    // The Monthly button is preselected (primary styling), badge still present,
    // no reassurance, and frequency is not in the missing-fields callout.
    await expect(page.getByRole('button', { name: 'Monthly', exact: true })).toHaveClass(/bg-primary-50/);
    await expect(page.getByText('Most popular')).toBeVisible();
    await expect(page.getByText('We can start at two months and evaluate after the first service.')).toHaveCount(0);
    await expect(page.getByText('Service frequency')).toHaveCount(0);
  });
});

// ── Full Order Flow with Stripe Test Mode ──

test.describe('Full Order Flow (Stripe Test Mode)', () => {
  test('should complete order with test card', async ({ page }) => {
    // Go to order page with params
    await page.goto(`${ORDER_BASE}?service=cleaning&length=35&type=sailboat&hull=monohull&frequency=monthly&estimate=157`);
    await page.waitForSelector('text=Schedule');

    // Fill boat details
    await page.locator('input[placeholder="Sea Spirit"]').fill('Test Vessel');
    await page.locator('input[placeholder="Beneteau"]').fill('Test Make');
    await page.locator('input[placeholder="Oceanis 40.1"]').fill('Test Model');

    // Fill location
    await page.locator('input[placeholder="Harbor Island West Marina"]').fill('Berkeley Marina');
    await page.locator('input[placeholder="C"]').fill('D');
    await page.locator('input[placeholder="42"]').first().fill('99');

    // Fill customer info
    await page.locator('input[placeholder="John Smith"]').fill('E2E Test User');
    await page.locator('input[placeholder="john@example.com"]').fill('test@example.com');
    await page.locator('input[placeholder="(510) 555-1234"]').fill('(510) 555-9999');
    await page.locator('input[placeholder="123 Main St"]').fill('123 Test St');
    await page.locator('input[placeholder="San Francisco"]').fill('Berkeley');
    await page.locator('input[placeholder="CA"]').fill('CA');
    await page.locator('input[placeholder="94107"]').first().fill('94710');

    // Wait for Stripe elements to load
    await page.waitForTimeout(3000);

    // Card number iframe
    const cardNumberFrame = page.frameLocator('iframe[title*="card number"]').first();
    await cardNumberFrame.locator('input[name="cardnumber"]').fill(STRIPE_TEST_CARD);

    // Expiry iframe
    const expiryFrame = page.frameLocator('iframe[title*="expiration"]').first();
    await expiryFrame.locator('input[name="exp-date"]').fill(STRIPE_TEST_EXP);

    // CVC iframe
    const cvcFrame = page.frameLocator('iframe[title*="CVC"]').first();
    await cvcFrame.locator('input[name="cvc"]').fill(STRIPE_TEST_CVC);

    // Check the agreement box
    await page.locator('#service-agreement').check();

    // Submit
    const submitBtn = page.getByText('Complete Order');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Wait for confirmation (up to 30s for network round-trip)
    await page.waitForSelector('text=Order Confirmed', { timeout: 30000 });
    await expect(page.getByText('Order Confirmed!')).toBeVisible();

    // Verify order number is shown
    const orderNumber = page.locator('.font-mono');
    await expect(orderNumber).toBeVisible();
    const orderText = await orderNumber.textContent();
    expect(orderText).toMatch(/^ORD-/);
  });
});

// Note: Navigation from calculator to order form is tested via unit tests
// (URL parameter passing) since React Router client-side navigation in 
// a Vite MPA setup is hard to test with Playwright's URL-based assertions.

test.describe('Legal documents', () => {
  test('serves Terms of Service on direct navigation', async ({ page }) => {
    const response = await page.goto('/terms');
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('heading', { name: 'SailorSkills Terms of Service' })).toBeVisible();
    await expect(page).toHaveTitle('Terms of Service — SailorSkills');
  });

  test('serves recurring authorization on direct navigation', async ({ page }) => {
    const response = await page.goto('/recurring-authorization');
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('heading', { name: 'Recurring Charge Authorization' })).toBeVisible();
    await expect(page).toHaveTitle('Recurring Charge Authorization — SailorSkills');
  });
});
