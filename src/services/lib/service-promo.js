const MARINA_VOUCHER_PATTERN = /^BM-[A-HJ-KM-NP-Z2-9]{5}$/;

function normalizePromoCode(code) {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

function formatDollars(cents) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

export function promoPreviewFor(rawCode, isRecurring) {
  const code = normalizePromoCode(rawCode);
  if (!code) return null;
  if (code === 'WELCOME26') {
    return isRecurring
      ? 'WELCOME26 — $75 off your first cleaning'
      : 'WELCOME26 applies to recurring cleaning plans only.';
  }
  if (MARINA_VOUCHER_PATTERN.test(code)) {
    return `${code} — $75 off your first hull cleaning`;
  }
  return 'Code will be validated at checkout.';
}

export function promoCodeForSubmission(rawCode, isRecurring) {
  const code = normalizePromoCode(rawCode);
  if (code === 'WELCOME26' && !isRecurring) return '';
  return code;
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
    if (code === 'WELCOME26' && applied.percentApplied === 50) {
      return 'WELCOME26 — $75 off your first cleaning';
    }
    return `${code} — ${applied.percentApplied}% off`;
  }
  return null;
}

