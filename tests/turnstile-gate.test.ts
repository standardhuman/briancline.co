import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { verifyTurnstile } from '../supabase/functions/_shared/lead-validation.ts'

const source = readFileSync(
  new URL('../supabase/functions/create-payment-intent/index.ts', import.meta.url),
  'utf8',
)

describe('Turnstile gate (create-payment-intent runs with verify_jwt = false)', () => {
  test('verifyTurnstile fails closed when the secret is unset', async () => {
    expect(await verifyTurnstile('tok', undefined, null)).toEqual({ ok: false, reason: 'turnstile-not-configured' })
    expect(await verifyTurnstile('tok', '', null)).toMatchObject({ ok: false })
  })

  test('verifyTurnstile rejects a missing token', async () => {
    expect(await verifyTurnstile(undefined, 'secret', null)).toEqual({ ok: false, reason: 'turnstile-missing' })
  })

  test('the handler rejects when the secret is unset, before verifying', () => {
    const guard = source.indexOf('if (!turnstileSecret)')
    const verify = source.indexOf('await verifyTurnstile(')
    expect(guard).toBeGreaterThan(0)
    expect(verify).toBeGreaterThan(guard)
  })

  test('the gate runs before any DB read or Stripe call in the handler', () => {
    const handler = source.slice(source.indexOf('serve(async (req)'))
    const verify = handler.indexOf('await verifyTurnstile(')
    const firstStripe = handler.search(/\bstripe\.\w+\.\w+\(/)
    const firstDb = handler.search(/supabase\s*\.from\(|loadAllowedMarinas\(supabase\)|supabase\.rpc\(/)
    expect(verify).toBeGreaterThan(0)
    expect(firstStripe).toBeGreaterThan(verify)
    expect(firstDb).toBeGreaterThan(verify)
  })

  test('the service key comes from the new-key resolver, not the legacy var directly', () => {
    expect(source).toMatch(/resolveSecretKey\(\)/)
    expect(source).not.toMatch(/Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)/)
  })
})
