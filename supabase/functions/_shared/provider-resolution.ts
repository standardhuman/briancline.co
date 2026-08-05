export interface ProviderOwnerLookup {
  findEligibleOwnerById(id: string): Promise<string | null>
  findSoleEligibleOwner(): Promise<string | null>
}

export type ProviderResolutionSource =
  | 'configured'
  | 'request'
  | 'sole-active'
  | 'invalid-config'
  | 'unresolved'
  | 'query-error'

export interface ProviderResolutionResult {
  ownerUserId: string | null
  source: ProviderResolutionSource
}

interface ProviderResolutionInput {
  configuredOwnerUserId?: string | null
  payload?: Record<string, unknown> | null
  formData?: Record<string, unknown> | null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function resolveProviderOwnerUserId(
  lookup: ProviderOwnerLookup,
  input: ProviderResolutionInput,
): Promise<ProviderResolutionResult> {
  try {
    const configured = nonEmptyString(input.configuredOwnerUserId)
    if (configured) {
      const ownerUserId = await lookup.findEligibleOwnerById(configured)
      return ownerUserId
        ? { ownerUserId, source: 'configured' }
        : { ownerUserId: null, source: 'invalid-config' }
    }

    const hint = nonEmptyString(
      input.payload?.providerId
      ?? input.payload?.provider_id
      ?? input.formData?.providerId,
    )
    if (hint) {
      const ownerUserId = await lookup.findEligibleOwnerById(hint)
      if (ownerUserId) return { ownerUserId, source: 'request' }
    }

    const ownerUserId = await lookup.findSoleEligibleOwner()
    return ownerUserId
      ? { ownerUserId, source: 'sole-active' }
      : { ownerUserId: null, source: 'unresolved' }
  } catch {
    return { ownerUserId: null, source: 'query-error' }
  }
}
