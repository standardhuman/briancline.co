/**
 * Live smoke checks for briancline.co's customer-facing surfaces.
 *
 * Read-only: pages are opened and clicked through, but no form is filled in
 * and submitted, no record is created, no payment is started and no email or
 * SMS is triggered. API checks use GET only.
 *
 * Each check asserts real content, not just HTTP 200, and its failure message
 * names the surface and the likely cause.
 *
 * Run: npx playwright test -c playwright.smoke.config.js
 */
import { resolveMx } from 'node:dns/promises';
import { test, expect } from '@playwright/test';

const SCHEDULER = 'https://schedule.briancline.co';

// Uncaught exceptions mean the page's JavaScript broke, even if static
// (prerendered) content still shows.
function trackPageErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

function expectNoPageErrors(errors, surface) {
  expect(errors, `${surface}: JavaScript crashed on the page (likely a bad deploy or a broken third-party script)`).toEqual([]);
}

const money = (s) => parseFloat(String(s).replace(/[^0-9.]/g, ''));

test.describe('briancline.co', () => {
  test('home page renders and its contact paths are present', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Brian Cline' }), 'Home: hero heading missing (likely a broken build or deploy)').toBeVisible();
    await expect(page.getByRole('heading', { name: "Let's Connect" }), 'Home: Connect section missing').toBeVisible();

    // The contact form is checked for presence only. Never submitted.
    const form = page.locator('#contact-form');
    await expect(form, 'Home: contact form missing').toBeVisible();
    await expect(form.locator('input[name="email"]'), 'Home: contact form email field missing').toBeVisible();
    await expect(form.getByRole('button', { name: /send/i }), 'Home: contact form send button missing').toBeVisible();

    await expect(page.locator(`a[href^="${SCHEDULER}"]`).first(), 'Home: scheduling link to schedule.briancline.co missing').toBeVisible();
    expectNoPageErrors(errors, 'Home');
  });

  test('/marine renders and its client-side navigation works', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/marine');

    for (const name of ['Hull Cleaning', 'Boat Detailing', 'Sailing Lessons', 'Vessel Deliveries']) {
      await expect(page.getByRole('heading', { name, exact: true }).first(), `/marine: "${name}" service card missing`).toBeVisible();
    }

    // Prerendered HTML shows even when JavaScript is broken, so prove the app
    // is live by navigating in-page to the hull-cleaning calculator.
    await page.locator('nav').getByRole('link', { name: 'Hull Cleaning' }).click();
    await expect(page, '/marine: nav link did not route to /hull-cleaning (likely the React app failed to start)').toHaveURL(/\/hull-cleaning$/);
    await expect(page.getByText('Your Estimate').first(), '/marine -> /hull-cleaning: calculator did not render after in-page navigation').toBeVisible();
    expectNoPageErrors(errors, '/marine');
  });

  test('hull-cleaning calculator computes and matches the quote API', async ({ page, request }) => {
    const errors = trackPageErrors(page);
    await page.goto('/hull-cleaning');

    await expect(page.getByRole('heading', { level: 1 }), '/hull-cleaning: page heading missing').toContainText('Hull Cleaning');
    const total = page.locator('.text-5xl').first();
    await expect(total, '/hull-cleaning: estimate total never rendered (calculator broken)').toHaveText(/\$\d/, { timeout: 15000 });

    // Default inputs are 35 ft, sailboat, monthly. The read-only quote API
    // must agree with what customers see.
    const length = page.locator('input[inputmode="numeric"]').first();
    await expect(length, '/hull-cleaning: boat length input missing').toHaveValue('35');
    const at35 = money(await total.textContent());

    const res = await request.get('/api/hull-cleaning-quote?service=cleaning&length=35&frequency=monthly');
    expect(res.status(), '/api/hull-cleaning-quote: not 200 (likely the API function failed to deploy)').toBe(200);
    const quote = await res.json();
    expect(quote?.estimate?.total, '/api/hull-cleaning-quote: no estimate total in response').toBeGreaterThan(0);
    expect(at35, '/hull-cleaning: calculator price disagrees with /api/hull-cleaning-quote (pricing out of sync)').toBe(quote.estimate.total);

    await length.fill('50');
    await expect.poll(async () => money(await total.textContent()), {
      message: '/hull-cleaning: estimate did not go up when boat length changed 35 -> 50 ft (calculator not reacting)',
      timeout: 5000,
    }).toBeGreaterThan(at35);
    expectNoPageErrors(errors, '/hull-cleaning');
  });

  test('sailing lessons page links to the booking flow', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/sailing-lessons');

    await expect(page.getByRole('heading', { level: 1 }), '/sailing-lessons: page heading missing').toContainText(/Sailing/);
    await expect(page.locator(`a[href="${SCHEDULER}/sailing"]`).first(), '/sailing-lessons: booking link to schedule.briancline.co/sailing missing').toBeVisible();
    expectNoPageErrors(errors, '/sailing-lessons');
  });

  test('boat detailing and deliveries pages render their lead forms', async ({ page }) => {
    const errors = trackPageErrors(page);

    await page.goto('/boat-detailing');
    await expect(page.getByRole('heading', { name: 'Build Your Estimate' }), '/boat-detailing: estimator missing').toBeVisible();
    await expect(page.locator('form').first(), '/boat-detailing: estimate request form missing').toBeVisible();

    await page.goto('/deliveries');
    await expect(page.getByRole('heading', { name: /Plan Your Delivery/ }), '/deliveries: inquiry section missing').toBeVisible();
    await expect(page.locator('form').first(), '/deliveries: inquiry form missing').toBeVisible();
    expectNoPageErrors(errors, '/boat-detailing or /deliveries');
  });

  test('form and API endpoints are deployed (GET only, nothing sent)', async ({ request }) => {
    // These accept POST only. A GET returning the function's own 405 JSON
    // proves the function deployed and runs, without sending anything.
    for (const path of ['/api/contact', '/api/delivery-inquiry', '/api/detailing-estimate', '/api/mcp']) {
      const res = await request.get(path);
      expect(res.status(), `${path}: expected the function's 405 to a GET, got ${res.status()} (function missing or crashing)`).toBe(405);
      // /api/mcp answers in JSON-RPC shape; the others with { error: "Method not allowed" }.
      const body = await res.json().catch(() => null);
      expect(body, `${path}: 405 body is not the function's own JSON error (route may be misconfigured)`).toHaveProperty('error');
    }
  });

  test('email to briancline.co can be delivered (MX records)', async () => {
    const mx = await resolveMx('briancline.co');
    expect(mx.map((r) => r.exchange), 'briancline.co: no MX records, so mail to brian@ / diving@ bounces (DNS change?)').toContainEqual(expect.stringMatching(/\S/));
  });
});

test.describe('schedule.briancline.co (sailing booking)', () => {
  test('booking flow shows session types and available times', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(`${SCHEDULER}/sailing`);

    await expect(page.getByRole('button', { name: /Free Consultation/ }), 'Scheduler: session types did not render (app down or its Supabase settings call failed)').toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Select a Date'), 'Scheduler: date picker missing').toBeVisible();

    // Pick an enabled day a few days out (today may already be booked or past
    // cutoff). Selecting a date only reads availability; nothing is booked.
    const days = page.getByRole('button', { name: /^\d{1,2}$/ });
    const enabled = [];
    for (let i = 0; i < await days.count(); i++) {
      if (await days.nth(i).isEnabled()) enabled.push(days.nth(i));
    }
    expect(enabled.length, 'Scheduler: no selectable dates in the calendar').toBeGreaterThan(0);
    await enabled[Math.min(3, enabled.length - 1)].click();

    await expect(page.getByText('Loading available times'), 'Scheduler: available times never finished loading (likely the google-calendar function or get_booked_slots failed)').toBeHidden({ timeout: 25000 });
    // Slot buttons start with the Pacific time; visitors in other time zones
    // also see their local time after it.
    const slot = page.getByRole('button', { name: /^\d{1,2}:\d{2}\s?(AM|PM)\b/ }).first();
    const none = page.getByText(/no (available )?times|fully booked|no availability/i).first();
    await expect(slot.or(none), 'Scheduler: after picking a date, neither time slots nor a "no times" message appeared').toBeVisible({ timeout: 5000 });
    expectNoPageErrors(errors, 'Scheduler');
  });
});
