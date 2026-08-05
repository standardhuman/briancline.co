/**
 * Post-build prerendering script using Playwright.
 * Spins up a local server, visits each service route,
 * and saves the rendered HTML as static files in dist/.
 * 
 * This ensures AI crawlers and search engines see actual content
 * instead of an empty <div id="services-root">.
 * 
 * Usage: node scripts/prerender.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import { createServer } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '..', 'dist');

// Routes to prerender (these are rewritten to services.html by Vercel)
const ROUTES = [
  '/marine',
  '/hull-cleaning',
  '/boat-detailing',
  '/sailing-lessons',
  '/sailing-lessons/faq',
  '/deliveries',
  '/terms',
  '/recurring-authorization',
];

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

async function prerender() {
  let chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch (err) {
    console.error('❌ Playwright not available — cannot prerender.');
    console.error('   It is a build-critical dependency; crawlers must see real content.');
    console.error(`   ${err.message}`);
    process.exit(1);
  }

  const servicesHtml = readFileSync(resolve(DIST, 'services.html'), 'utf-8');

  const server = createServer(async (req, res) => {
    let url = req.url.split('?')[0];

    // Service routes → serve services.html
    const isServiceRoute = ROUTES.some(r => url === r || url.startsWith(r + '/'));
    if (isServiceRoute) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(servicesHtml);
      return;
    }

    // Static files
    let filePath = join(DIST, url === '/' ? 'index.html' : url);
    try {
      const content = await readFile(filePath);
      const ext = extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  const port = 4173 + Math.floor(Math.random() * 1000);
  await new Promise(r => server.listen(port, r));
  console.log(`🌐 Prerender server on http://localhost:${port}`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.error(`❌ Failed to launch browser: ${err.message}`);
    console.error('   Ensure the Chromium binary is installed (npx playwright install chromium-headless-shell).');
    server.close();
    process.exit(1);
  }
  const context = await browser.newContext();

  const failures = [];

  for (const route of ROUTES) {
    const page = await context.newPage();
    const url = `http://localhost:${port}${route}`;
    console.log(`📄 Prerendering ${route}...`);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      // Wait for React content to appear
      await page.waitForSelector('nav', { timeout: 10000 }).catch(() => {});

      const html = await page.content();

      // Write to dist/[route]/index.html (for clean URLs)
      const outDir = resolve(DIST, route.slice(1));
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, 'index.html'), html);
      console.log(`   ✓ ${route} → ${route.slice(1)}/index.html`);
    } catch (err) {
      console.log(`   ✗ ${route}: ${err.message}`);
      failures.push(`${route} — render failed: ${err.message}`);
    }

    await page.close();
  }

  await browser.close();
  server.close();

  // Verify output: every route must have produced a file with a route-specific
  // <title>. The generic services.html title means React never rendered.
  const GENERIC_TITLE = 'Marine Services | Brian Cline';
  for (const route of ROUTES) {
    const file = resolve(DIST, route.slice(1), 'index.html');
    if (!existsSync(file)) {
      failures.push(`${route} — no output file at ${route.slice(1)}/index.html`);
      continue;
    }
    const match = readFileSync(file, 'utf-8').match(/<title>([^<]*)<\/title>/i);
    const title = match ? match[1].trim() : '';
    if (!title) {
      failures.push(`${route} — missing or empty <title>`);
    } else if (title === GENERIC_TITLE) {
      failures.push(`${route} — generic <title> "${title}" (React did not render)`);
    }
  }

  if (failures.length > 0) {
    console.error(`❌ Prerender failed for ${failures.length} route(s):`);
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }

  console.log(`✅ Prerendered ${ROUTES.length} routes`);
}

prerender().catch(err => {
  console.error('❌ Prerender error:', err.message);
  process.exit(1);
});
