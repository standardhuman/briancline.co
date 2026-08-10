import {
  SERVICES,
  calculateEstimate,
  estimateScale,
} from './diving-calculator.js';

function dollarsToCents(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount) * 100;
}

/**
 * Derive the price representation the customer is currently reviewing.
 *
 * Cleaning quotes come from the live condition scale: a real matrix cell is an
 * exact quote, while either unknown condition preserves the honest full range.
 * Other services have no condition uncertainty and remain exact.
 */
export function deriveCheckoutQuote(inputs = {}) {
  const { serviceKey } = inputs;
  if (!SERVICES[serviceKey]) return null;

  if (serviceKey === 'cleaning') {
    const scale = estimateScale(inputs);
    if (!scale) return null;

    if (scale.hasPrediction) {
      const amountCents = dollarsToCents(scale.predictedPrice);
      return amountCents == null ? null : { mode: 'exact', amountCents };
    }

    const minCents = dollarsToCents(scale.minPrice);
    const maxCents = dollarsToCents(scale.maxPrice);
    if (minCents == null || maxCents == null || minCents > maxCents) return null;
    if (minCents === maxCents) return { mode: 'exact', amountCents: minCents };
    return { mode: 'range', minCents, maxCents };
  }

  if (SERVICES[serviceKey].type === 'per_foot') {
    const length = Number.parseInt(inputs.boatLength, 10);
    if (!Number.isFinite(length) || length < 1) return null;
  }

  const estimate = calculateEstimate(inputs);
  const amountCents = dollarsToCents(estimate.total);
  return amountCents == null ? null : { mode: 'exact', amountCents };
}
