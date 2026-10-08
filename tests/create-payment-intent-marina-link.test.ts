import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(
  path.join(here, '../supabase/functions/create-payment-intent/index.ts'),
  'utf8',
)

// Source-text assertions (the edge function is Deno and cannot be imported here),
// same convention as create-payment-intent-write-errors.test.ts.
describe('create-payment-intent marina + Stripe customer linkage', () => {
  it('never writes the marinas table from checkout', () => {
    // The old upsert({ name }, { onConflict: 'name' }) minted rows from customer
    // text and has failed with 42P10 since the global name index was dropped.
    expect(source).not.toMatch(/from\('marinas'\)\s*\.(upsert|insert|update|delete)\(/)
    expect(source).not.toContain("onConflict: 'name'")
  })

  it('resolves the marina before the boat write and links it on the boat', () => {
    const resolveAt = source.indexOf('await resolveMarina(')
    expect(resolveAt).toBeGreaterThan(-1)
    expect(resolveAt).toBeLessThan(source.indexOf("from('boats')\n          .update(boatData)"))
    expect(source).toContain('if (marinaId) boatData.marina_id = marinaId')
  })

  it('links the marina on the service order', () => {
    expect(source).toContain('marina_id: marinaId,')
  })

  it('warns (does not fail) when the marina cannot be linked', () => {
    expect(source).toContain('[checkout-marina-unlinked]')
  })

  it('stamps boats.stripe_customer_id without overwriting a different existing id', () => {
    expect(source).toContain('if (!existingBoat?.stripe_customer_id) {')
    expect(source).toContain('boatData.stripe_customer_id = stripeCustomer.id')
    expect(source).toContain('[checkout-boat-stripe-mismatch]')
  })
})
