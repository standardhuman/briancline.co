export type CheckoutQuote =
  | { mode: 'exact'; amountCents: number }
  | { mode: 'range'; minCents: number; maxCents: number }

export type PricingConfig = Record<string, number>

const DEFAULTS: PricingConfig = {
  minimum_service_charge: 150,
  recurring_cleaning_rate: 4.5,
  onetime_cleaning_rate: 6,
  underwater_inspection_rate: 3.99,
  item_recovery_rate: 199,
  propeller_service_rate: 349,
  anodes_only_rate: 149,
  anode_installation_rate: 15,
}

const PAINT_AGES = ['<6mo', '6-12mo', '1-1.5yr', '1.5-2yr', '2+yr'] as const
const LAST_CLEANED = ['<2', '2-4', '5-6', '7-8', '9-12', '13-24', '24+'] as const

const SEVERITY_SURCHARGE: Record<string, number> = {
  MIN: 0,
  'M-MOD': 0,
  MOD: 0,
  'M-H': 0.375,
  H: 0.5,
  'H-S': 0.75,
  S: 1,
  SEV: 2,
}

const MATRIX: Record<string, Array<string | null>> = {
  '<2': ['MIN', 'MIN', 'MIN', 'MOD', 'M-H'],
  '2-4': ['MIN', 'M-MOD', 'M-MOD', 'MOD', 'M-H'],
  '5-6': ['MOD', 'MOD', 'MOD', 'M-H', 'H'],
  '7-8': [null, 'M-H', 'M-H', 'H', 'H-S'],
  '9-12': [null, null, 'H', 'H-S', 'SEV'],
  '13-24': [null, null, 'H-S', 'S', 'SEV'],
  '24+': [null, null, null, 'S', 'SEV'],
}

const FREQUENCIES = new Set([
  'monthly', 'bimonthly', 'quarterly', 'one_time', 'one-time', 'onetime',
  '1', '2', '3', '6',
])

function configured(config: PricingConfig, key: string): number {
  const value = config[key]
  return Number.isFinite(value) && value > 0 ? value : DEFAULTS[key]
}

function dollarsToCents(amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount) * 100
}

function positiveInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return null
  return value
}

export function parseSubmittedQuote(value: unknown): CheckoutQuote | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const quote = value as Record<string, unknown>

  if (quote.mode === 'exact') {
    if ('minCents' in quote || 'maxCents' in quote) return null
    const amountCents = positiveInteger(quote.amountCents)
    return amountCents == null ? null : { mode: 'exact', amountCents }
  }

  if (quote.mode === 'range') {
    if ('amountCents' in quote) return null
    const minCents = positiveInteger(quote.minCents)
    const maxCents = positiveInteger(quote.maxCents)
    if (minCents == null || maxCents == null || minCents >= maxCents) return null
    return { mode: 'range', minCents, maxCents }
  }

  return null
}

export function quotesEqual(left: CheckoutQuote | null, right: CheckoutQuote | null): boolean {
  if (!left || !right || left.mode !== right.mode) return false
  if (left.mode === 'exact' && right.mode === 'exact') {
    return left.amountCents === right.amountCents
  }
  if (left.mode === 'range' && right.mode === 'range') {
    return left.minCents === right.minCents && left.maxCents === right.maxCents
  }
  return false
}

function parseInteger(value: unknown, minimum: number, maximum: number): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = String(value).trim()
  if (!/^\d+$/.test(normalized)) return null
  const parsed = Number.parseInt(normalized, 10)
  return parsed >= minimum && parsed <= maximum ? parsed : null
}

function boatLengthFor(formData: any): number | null {
  const top = parseInteger(formData?.boatLength, 10, 300)
  const nestedRaw = formData?.serviceDetails?.boatLength
  if (nestedRaw == null || nestedRaw === '') return top
  const nested = parseInteger(nestedRaw, 10, 300)
  if (top == null || nested == null || top !== nested) return null
  return top
}

function foulingSurcharge(paintAge: string, lastCleaned: string): number | null {
  const column = PAINT_AGES.indexOf(paintAge as typeof PAINT_AGES[number])
  const row = MATRIX[lastCleaned]
  if (column < 0 || !row) return null

  let severity = row[column]
  if (severity == null) {
    severity = row.slice(column + 1).find((candidate) => candidate != null) ?? 'SEV'
  }
  return SEVERITY_SURCHARGE[severity] ?? null
}

function exact(amount: number): CheckoutQuote | null {
  const amountCents = dollarsToCents(amount)
  return amountCents == null ? null : { mode: 'exact', amountCents }
}

export function calculateCanonicalQuote(formData: any, config: PricingConfig = {}): CheckoutQuote | null {
  const service = formData?.service
  const details = formData?.serviceDetails ?? {}
  const minimum = configured(config, 'minimum_service_charge')

  if (service === 'Item Recovery') {
    return exact(configured(config, 'item_recovery_rate'))
  }

  if (service === 'Propeller Service') {
    const propellers = parseInteger(formData?.propellerCount ?? details.propellerCount, 1, 8)
    if (propellers == null) return null
    return exact(configured(config, 'propeller_service_rate') * propellers)
  }

  if (service === 'Anodes Only') {
    const anodes = parseInteger(details.anodeCount ?? formData?.anodeCount ?? 0, 0, 100)
    if (anodes == null) return null
    return exact(Math.max(minimum, anodes * configured(config, 'anode_installation_rate')))
  }

  if (service !== 'Cleaning & Anodes' && service !== 'Underwater Inspection') return null

  const boatLength = boatLengthFor(formData)
  if (boatLength == null) return null
  if (!['sailboat', 'powerboat'].includes(details.boatType)) return null
  if (!['monohull', 'catamaran', 'trimaran'].includes(details.hullType)) return null

  const isCleaning = service === 'Cleaning & Anodes'
  const frequency = String(formData?.serviceInterval ?? '')
  if (isCleaning && !FREQUENCIES.has(frequency)) return null
  const isOneTime = !isCleaning || ['one_time', 'one-time', 'onetime'].includes(frequency)
  const rate = isCleaning
    ? configured(config, isOneTime ? 'onetime_cleaning_rate' : 'recurring_cleaning_rate')
    : configured(config, 'underwater_inspection_rate')

  const base = boatLength * rate
  let fixed = base
  if (details.boatType === 'powerboat') fixed += base * 0.25
  if (details.hullType === 'catamaran') fixed += base * 0.25
  if (details.hullType === 'trimaran') fixed += base * 0.5

  if (!isCleaning) return exact(Math.max(minimum, fixed))

  const propellers = parseInteger(details.propellerCount ?? 1, 1, 8)
  const anodes = parseInteger(details.anodeCount ?? 0, 0, 100)
  if (propellers == null || anodes == null) return null
  fixed += base * Math.max(0, propellers - 1) * 0.1
  fixed += anodes * configured(config, 'anode_installation_rate')

  const paintAge = typeof details.paintAge === 'string' ? details.paintAge : ''
  const lastCleaned = typeof details.lastCleaned === 'string' ? details.lastCleaned : ''
  const paintKnown = paintAge !== ''
  const cleanedKnown = lastCleaned !== ''

  if (paintKnown && !PAINT_AGES.includes(paintAge as typeof PAINT_AGES[number])) return null
  if (cleanedKnown && !LAST_CLEANED.includes(lastCleaned as typeof LAST_CLEANED[number])) return null

  if (!paintKnown || !cleanedKnown) {
    const minCents = dollarsToCents(Math.max(minimum, fixed))
    const maxCents = dollarsToCents(Math.max(minimum, fixed + base * 2))
    if (minCents == null || maxCents == null) return null
    if (minCents === maxCents) return { mode: 'exact', amountCents: minCents }
    return { mode: 'range', minCents, maxCents }
  }

  const growth = foulingSurcharge(paintAge, lastCleaned)
  return growth == null ? null : exact(Math.max(minimum, fixed + base * growth))
}
