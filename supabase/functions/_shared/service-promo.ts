export type ServicePromoDiscountType = 'percent' | 'amount'

export interface PromoApplied {
  code: string
  discountType: ServicePromoDiscountType
  percentApplied: number | null
  amountAppliedCents: number | null
}

export type ParsedPromoClaim =
  | { ok: true; redemptionId: string; applied: PromoApplied }
  | { ok: false; errorCode: string }

const PROMO_ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "That promo code isn't valid.",
  already_used: 'That promo code has already been used.',
  expired: 'That promo code has expired.',
  rate_limited: 'Too many promo attempts. Please wait and try again.',
  rpc_failure: 'We could not validate your promo code right now. Please remove the code and try again, or retry in a moment.',
}

export function promoErrorMessage(errorCode: string): string {
  return PROMO_ERROR_MESSAGES[errorCode] ?? 'That promo code could not be applied.'
}

/** Preserve the currently shipped WELCOME26 rule without imposing it on new
 * serialized vouchers, which are valid for one-time and recurring cleanings. */
export function promoNotApplicableMessage(code: string, isRecurring: boolean): string | null {
  if (code.trim().toUpperCase() === 'WELCOME26' && !isRecurring) {
    return 'That promo code applies to recurring cleaning plans only.'
  }
  return null
}

/** Release only an unconsumed reservation when checkout fails after a
 * successful claim. This is deliberately best-effort: the original checkout
 * error remains the customer-facing result, while a cleanup failure is logged
 * for operations rather than masking it. */
export async function releaseReservedPromoClaim(
  supabase: any,
  redemptionId: string | null,
): Promise<boolean> {
  if (!redemptionId) return false
  try {
    const { error } = await supabase
      .from('service_promo_redemptions')
      .update({ status: 'released' })
      .eq('id', redemptionId)
      .eq('status', 'reserved')
    if (error) {
      console.error('[create-payment-intent] Promo reservation release failed:', error.message)
      return false
    }
    return true
  } catch (error) {
    console.error(
      '[create-payment-intent] Promo reservation release threw:',
      error instanceof Error ? error.message : String(error),
    )
    return false
  }
}

export function parsePromoClaimRow(row: unknown, rawCode: string): ParsedPromoClaim {
  if (!row || typeof row !== 'object') return { ok: false, errorCode: 'rpc_failure' }
  const value = row as Record<string, unknown>
  if (typeof value.error_code === 'string' && value.error_code) {
    return { ok: false, errorCode: value.error_code }
  }
  if (typeof value.redemption_id !== 'string' || !value.redemption_id) {
    return { ok: false, errorCode: 'rpc_failure' }
  }

  // Old production RPC rows have no discount_type; percent is the only valid
  // old shape, so defaulting them is backward-compatible during rollout.
  const discountType = value.discount_type == null ? 'percent' : value.discount_type
  if (discountType !== 'percent' && discountType !== 'amount') {
    return { ok: false, errorCode: 'rpc_failure' }
  }

  const percentApplied = typeof value.percent_applied === 'number' && Number.isInteger(value.percent_applied)
    ? value.percent_applied
    : null
  const amountAppliedCents = typeof value.amount_applied_cents === 'number' && Number.isInteger(value.amount_applied_cents)
    ? value.amount_applied_cents
    : null
  if (
    (discountType === 'percent' && (!(percentApplied && percentApplied > 0) || amountAppliedCents != null))
    || (discountType === 'amount' && (!(amountAppliedCents && amountAppliedCents > 0) || percentApplied != null))
  ) {
    return { ok: false, errorCode: 'rpc_failure' }
  }

  return {
    ok: true,
    redemptionId: value.redemption_id,
    applied: {
      code: rawCode.trim().toUpperCase(),
      discountType,
      percentApplied,
      amountAppliedCents,
    },
  }
}
