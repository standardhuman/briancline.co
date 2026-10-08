// Read-only hull-cleaning quote for people and AI assistants.
// GET /api/hull-cleaning-quote?service=cleaning&length=35&frequency=monthly
// Same math as the /hull-cleaning estimator (src/services/lib/diving-calculator.js).
// No writes, no personal data, nothing is booked or charged.
import { parseQuoteQuery, buildQuote, PRICING_JSON_URL } from '../src/services/lib/hull-cleaning-public.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const parsed = parseQuoteQuery(req.query || {});
  if (!parsed.ok) {
    return res.status(400).json({ error: 'Invalid parameters', details: parsed.errors, docs: PRICING_JSON_URL });
  }

  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json(buildQuote(parsed.input));
}
