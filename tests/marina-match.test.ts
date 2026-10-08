import { describe, expect, test } from 'vitest'
import {
  chooseCanonicalMarina,
  marinaIlikePattern,
  marinaKey,
  resolveMarina,
  type MarinaCandidate,
  type MarinaLookup,
} from '../supabase/functions/_shared/marina-match.ts'

const OWNER = '00000000-0000-4000-8000-0000000000aa'
const PROVIDER = '00000000-0000-4000-8000-0000000000bb'

function row(id: string, name: string, extra: Partial<MarinaCandidate> = {}): MarinaCandidate {
  return { id, name, is_allowed: true, created_at: '2026-05-13T00:00:00Z', ...extra }
}

function lookup(
  rows: MarinaCandidate[],
  opts: { providerId?: string | null; boats?: Record<string, number> } = {},
): MarinaLookup & { patterns: string[] } {
  const patterns: string[] = []
  return {
    patterns,
    findProviderId: async (owner) => (owner === OWNER ? (opts.providerId === undefined ? PROVIDER : opts.providerId) : null),
    findCandidates: async (providerId, pattern) => {
      patterns.push(pattern)
      return providerId === PROVIDER ? rows : []
    },
    countBoats: async (id) => opts.boats?.[id] ?? 0,
  }
}

describe('marinaKey', () => {
  test('is case- and whitespace-insensitive', () => {
    expect(marinaKey('  Berkeley   Marina ')).toBe('berkeley marina')
    expect(marinaKey('BERKELEY MARINA')).toBe('berkeley marina')
    expect(marinaKey('Berkeley marina\t')).toBe('berkeley marina')
  })
  test('non-strings and blanks are empty', () => {
    expect(marinaKey(undefined)).toBe('')
    expect(marinaKey(42)).toBe('')
    expect(marinaKey('   ')).toBe('')
  })
})

describe('marinaIlikePattern', () => {
  test('joins words with wildcards so stored whitespace variants are found', () => {
    expect(marinaIlikePattern('berkeley marina')).toBe('%berkeley%marina%')
  })
  test('escapes LIKE metacharacters in customer text', () => {
    expect(marinaIlikePattern('pier 1_5 100%')).toBe('%pier%1\\_5%100\\%%')
  })
})

describe('chooseCanonicalMarina', () => {
  test('prefers is_allowed, then most boats, then oldest', () => {
    const chosen = chooseCanonicalMarina([
      { ...row('a', 'Berkeley marina ', { is_allowed: false }), boatCount: 500 },
      { ...row('b', 'Berkeley Marina '), boatCount: 0 },
      { ...row('c', 'Berkeley Marina'), boatCount: 184 },
    ])
    expect(chosen?.id).toBe('c')
  })
  test('empty input => null', () => {
    expect(chooseCanonicalMarina([])).toBeNull()
  })
})

describe('resolveMarina', () => {
  test('links the exact-key match among whitespace variants (the Bada Bing case)', async () => {
    const l = lookup(
      [
        row('dup-trailing', 'Berkeley Marina '),
        row('canonical', 'Berkeley Marina'),
        row('not-allowed', 'Berkeley marina ', { is_allowed: false }),
        row('other', 'Berkeley Marina Annex'), // ILIKE superset; not an exact key
      ],
      { boats: { canonical: 184, 'dup-trailing': 0, 'not-allowed': 0 } },
    )
    const r = await resolveMarina(l, { marinaName: 'berkeley  MARINA', providerOwnerUserId: OWNER })
    expect(r).toEqual({ marinaId: 'canonical', marinaName: 'Berkeley Marina', source: 'match' })
    expect(l.patterns).toEqual(['%berkeley%marina%'])
  })

  test('no match => null, never a substring/fuzzy link', async () => {
    const r = await resolveMarina(lookup([row('m', 'Berkeley Marina')]), {
      marinaName: 'Berkeley', providerOwnerUserId: OWNER,
    })
    expect(r).toEqual({ marinaId: null, source: 'no_match', key: 'berkeley' })
  })

  test('unknown provider => null (no cross-tenant or catalog link)', async () => {
    const r = await resolveMarina(lookup([row('m', 'Berkeley Marina')], { providerId: null }), {
      marinaName: 'Berkeley Marina', providerOwnerUserId: OWNER,
    })
    expect(r.marinaId).toBeNull()
    expect(r.source).toBe('no_provider')
  })

  test('blank name => null without any lookup', async () => {
    const l = lookup([row('m', 'Berkeley Marina')])
    const r = await resolveMarina(l, { marinaName: '  ', providerOwnerUserId: OWNER })
    expect(r.source).toBe('empty')
    expect(l.patterns).toEqual([])
  })
})
