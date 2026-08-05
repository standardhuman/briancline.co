import { describe, expect, test } from 'vitest'
import {
  resolveProviderOwnerUserId,
  type ProviderOwnerLookup,
} from '../supabase/functions/_shared/provider-resolution.ts'

const ownerA = '00000000-0000-4000-8000-000000000001'
const ownerB = '00000000-0000-4000-8000-000000000002'

function lookup(overrides: Partial<ProviderOwnerLookup> = {}): ProviderOwnerLookup {
  return {
    findEligibleOwnerById: async () => null,
    findSoleEligibleOwner: async () => null,
    ...overrides,
  }
}

describe('resolveProviderOwnerUserId', () => {
  test('validated server configuration wins over an untrusted request hint', async () => {
    const result = await resolveProviderOwnerUserId(lookup({
      findEligibleOwnerById: async (id) => id === ownerA ? ownerA : ownerB,
    }), {
      configuredOwnerUserId: ownerA,
      payload: { providerId: ownerB },
      formData: {},
    })
    expect(result).toEqual({ ownerUserId: ownerA, source: 'configured' })
  })

  test('invalid server configuration fails closed without falling back', async () => {
    let soleLookupCalled = false
    const result = await resolveProviderOwnerUserId(lookup({
      findSoleEligibleOwner: async () => { soleLookupCalled = true; return ownerB },
    }), {
      configuredOwnerUserId: ownerA,
      payload: {},
      formData: {},
    })
    expect(result).toEqual({ ownerUserId: null, source: 'invalid-config' })
    expect(soleLookupCalled).toBe(false)
  })

  test('validates a legacy request hint when no server default exists', async () => {
    const result = await resolveProviderOwnerUserId(lookup({
      findEligibleOwnerById: async (id) => id === ownerB ? ownerB : null,
    }), {
      configuredOwnerUserId: null,
      payload: { provider_id: ownerB },
      formData: {},
    })
    expect(result).toEqual({ ownerUserId: ownerB, source: 'request' })
  })

  test('uses the sole eligible provider only when no configured owner or hint exists', async () => {
    const result = await resolveProviderOwnerUserId(lookup({
      findSoleEligibleOwner: async () => ownerA,
    }), { configuredOwnerUserId: null, payload: {}, formData: {} })
    expect(result).toEqual({ ownerUserId: ownerA, source: 'sole-active' })
  })

  test('returns unresolved when no unique fallback exists', async () => {
    const result = await resolveProviderOwnerUserId(
      lookup(),
      { configuredOwnerUserId: null, payload: {}, formData: {} },
    )
    expect(result).toEqual({ ownerUserId: null, source: 'unresolved' })
  })

  test('contains lookup failures and reports query-error', async () => {
    const result = await resolveProviderOwnerUserId(lookup({
      findEligibleOwnerById: async () => { throw new Error('database detail') },
    }), {
      configuredOwnerUserId: ownerA,
      payload: {},
      formData: {},
    })
    expect(result).toEqual({ ownerUserId: null, source: 'query-error' })
  })
})
