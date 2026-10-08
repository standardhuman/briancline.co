// Marina resolution for create-payment-intent: which EXISTING `marinas` row a
// storefront order's free-text marina name links to.
//
// Background: checkout used to `marinas.upsert({ name }, { onConflict: 'name' })`.
// That (a) minted a new marinas row from whatever the customer typed, which is
// how prod accumulated "Berkeley marina ", "Berkeley Marina ", "berkeley", ...;
// and (b) has failed with 42P10 on every checkout since the global unique index
// on marinas.name was dropped (2026-07-29) — leaving boats.marina_id and
// service_orders.marina_id NULL, so Pro shows the marina as "N/A".
//
// Rules:
//   - NEVER create a marinas row from customer text. No match => marina_id stays
//     NULL, the free-text boats.marina is kept, and the caller logs a warning.
//   - Match only the servicing provider's own marinas (marinas.provider_id is the
//     service_providers.id referent). A NULL-provider catalog row or another
//     tenant's row is never linked to this provider's boat.
//   - Match is case- and whitespace-insensitive: lower(trim(name)) with internal
//     whitespace runs collapsed. No fuzzy/substring matching.
//   - When several rows share the key (whitespace variants), prefer is_allowed,
//     then the row with the most boats, then the oldest, then the lowest id.
//
// The pure parts (key, pattern, ranking) carry no Deno / supabase imports so the
// site's vitest suite can test them; the edge function supplies the I/O through
// `MarinaLookup`.

export interface MarinaCandidate {
  id: string
  name: string
  is_allowed: boolean | null
  created_at: string | null
}

export interface MarinaLookup {
  /** service_providers.id for the provider owner user id, or null if not exactly one. */
  findProviderId(ownerUserId: string): Promise<string | null>
  /** This provider's marinas whose name ILIKE `pattern` (a superset of the key match). */
  findCandidates(providerId: string, pattern: string): Promise<MarinaCandidate[]>
  /** Number of boats linked to the marina (used only to break ties). */
  countBoats(marinaId: string): Promise<number>
}

export type MarinaResolution =
  | { marinaId: string; marinaName: string; source: 'match' }
  | { marinaId: null; source: 'empty' | 'no_provider' | 'no_match'; key: string }

/** Comparison key: lowercase, trimmed, internal whitespace collapsed. */
export function marinaKey(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * ILIKE pattern that finds every row whose key could equal `key`: each word
 * LIKE-escaped, words joined (and wrapped) with `%` so stray/duplicated spaces
 * in the stored name still match. Callers filter the rows by exact key after.
 */
export function marinaIlikePattern(key: string): string {
  const words = key.split(' ').filter(Boolean).map((w) => w.replace(/[\\%_]/g, (c) => `\\${c}`))
  return `%${words.join('%')}%`
}

/** Pick the canonical row among exact-key matches. Pure. */
export function chooseCanonicalMarina(
  matches: Array<MarinaCandidate & { boatCount: number }>,
): (MarinaCandidate & { boatCount: number }) | null {
  if (matches.length === 0) return null
  return [...matches].sort((a, b) => {
    const allowed = Number(b.is_allowed === true) - Number(a.is_allowed === true)
    if (allowed !== 0) return allowed
    if (b.boatCount !== a.boatCount) return b.boatCount - a.boatCount
    const at = a.created_at ?? '9999', bt = b.created_at ?? '9999'
    if (at !== bt) return at < bt ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })[0]
}

/** Resolve the order's marina name to an existing provider-scoped marinas row. Read-only. */
export async function resolveMarina(
  lookup: MarinaLookup,
  opts: { marinaName: unknown; providerOwnerUserId: string },
): Promise<MarinaResolution> {
  const key = marinaKey(opts.marinaName)
  if (!key) return { marinaId: null, source: 'empty', key }

  const providerId = await lookup.findProviderId(opts.providerOwnerUserId)
  if (!providerId) return { marinaId: null, source: 'no_provider', key }

  const candidates = await lookup.findCandidates(providerId, marinaIlikePattern(key))
  const exact = candidates.filter((c) => marinaKey(c.name) === key)
  if (exact.length === 0) return { marinaId: null, source: 'no_match', key }

  const withCounts = exact.length === 1
    ? [{ ...exact[0], boatCount: 0 }]
    : await Promise.all(exact.map(async (c) => ({ ...c, boatCount: await lookup.countBoats(c.id) })))
  const chosen = chooseCanonicalMarina(withCounts)!
  return { marinaId: chosen.id, marinaName: chosen.name, source: 'match' }
}
