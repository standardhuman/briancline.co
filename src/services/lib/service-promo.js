const MARINA_VOUCHER_PATTERN = /^BM-[A-HJ-KM-NP-Z2-9]{5}$/;

function normalizePromoCode(code) {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}
function formatDollars(cents) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

export function promoPreviewFor(rawCode) {
  const code = normalizePromoCode(rawCode);
  if (!code) return null;
  // WELCOME26 is a flat $75 off the first cleaning on every plan — one-time and
  // recurring alike. No plan-dependent copy.
  if (code === 'WELCOME26') {
    return 'WELCOME26 — $75 off your first cleaning';
  }
  if (MARINA_VOUCHER_PATTERN.test(code)) {
    return `${code} — $75 off your first hull cleaning`;
  }
  return 'Code will be validated at checkout.';
}

export function promoCodeForSubmission(rawCode) {
  return normalizePromoCode(rawCode);
}

export function promoConfirmation(applied) {
  if (!applied || typeof applied !== 'object') return null;
  const code = normalizePromoCode(applied.code);
  if (!code) return null;
  if (
    applied.discountType === 'amount'
    && Number.isInteger(applied.amountAppliedCents)
    && applied.amountAppliedCents > 0
  ) {
    return `${code} — ${formatDollars(applied.amountAppliedCents)} off your first hull cleaning`;
  }
  if (
    applied.discountType === 'percent'
    && Number.isInteger(applied.percentApplied)
    && applied.percentApplied > 0
  ) {
    return `${code} — ${applied.percentApplied}% off`;
  }
  return null;
}
