/**
 * Live smoke check: does the hull-cleaning order form load?
 *
 * Read-only. Opens the page and waits for the form and Stripe's card field.
 * Never types into the form or submits anything.
 * Run: SMOKE_URL=https://briancline.co npx playwright test -c playwright.smoke.config.js
 */
import { test, expect } from '@playwright/test';

test('hull-cleaning order form loads', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.goto('/hull-cleaning/order');

  const form = page.getByTestId('order-form');
  const fallback = page.getByTestId('order-unavailable');
  await expect(form.or(fallback), 'neither the form nor the fallback appeared').toBeVisible({ timeout: 30000 });

  if (await fallback.isVisible()) {
    throw new Error(
      'Order form failed to load: customers see the email/phone fallback.\n' +
      `Console errors:\n${consoleErrors.join('\n') || '(none)'}`,
    );
  }

  // The form only renders once Stripe.js is loaded; the card field proves it.
  await expect(page.locator('iframe[name^="__privateStripeFrame"]').first()).toBeAttached({ timeout: 15000 });
});
