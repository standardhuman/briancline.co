// Writes public/pricing/hull-cleaning.json from the calculator, so the published
// rate card can never drift from the /hull-cleaning estimator. Runs before every
// build; tests/hull-cleaning-public.test.js fails if the committed copy is stale.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPricingSummary } from '../src/services/lib/hull-cleaning-public.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PRICING_JSON_PATH = resolve(root, 'public/pricing/hull-cleaning.json');

export function pricingJsonText() {
  return JSON.stringify(buildPricingSummary(), null, 2) + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(PRICING_JSON_PATH), { recursive: true });
  writeFileSync(PRICING_JSON_PATH, pricingJsonText());
  console.log(`Wrote ${PRICING_JSON_PATH}`);
}
