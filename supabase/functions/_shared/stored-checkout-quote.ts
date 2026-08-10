import type { CheckoutQuote } from './checkout-quote.ts'

export interface FormattedCheckoutQuote {
  label: 'Estimated Cost' | 'Estimated Range'
  value: string
  phrase: string
}

function dollarsToCents(value: unknown): number | null {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100)
}

export function readStoredCheckoutQuote(order: Record<string, unknown>): CheckoutQuote | null {
  if (order.estimate_mode === 'exact') {
    const amountCents = dollarsToCents(order.estimated_amount)
    if (amountCents == null || order.estimated_min_amount != null || order.estimated_max_amount != null) return null
    return { mode: 'exact', amountCents }
  }

  if (order.estimate_mode === 'range') {
    const minCents = dollarsToCents(order.estimated_min_amount)
    const maxCents = dollarsToCents(order.estimated_max_amount)
    if (minCents == null || maxCents == null || minCents > maxCents || order.estimated_amount != null) return null
    return { mode: 'range', minCents, maxCents }
  }

  return null
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function formatCheckoutQuoteForEmail(quote: CheckoutQuote): FormattedCheckoutQuote {
  if (quote.mode === 'exact') {
    const value = formatCents(quote.amountCents)
    return { label: 'Estimated Cost', value, phrase: `${value} estimated` }
  }

  const value = `${formatCents(quote.minCents)}–${formatCents(quote.maxCents)}`
  return { label: 'Estimated Range', value, phrase: `${value} estimated range` }
}
