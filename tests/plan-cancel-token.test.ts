import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, test, vi } from 'vitest'
import {
  buildPlanCancelUrl,
  planCancelMessage,
  signPlanCancelToken,
} from '../supabase/functions/_shared/plan-cancel-token.ts'

// Shared cross-repo vector: SailorSkills Pro asserts the same token.
const SECRET = 'test-secret'
const BOAT_ID = '00000000-0000-0000-0000-000000000001'
const EXPECTED_TOKEN =
  '00000000-0000-0000-0000-000000000001.U_HYGd-XbArJsRNbyDSA7a5xRNR1ZG44BakvOl4cZto'

const env = (vars: Record<string, string | undefined>) => (name: string) => vars[name]

function nodeToken(secret: string, boatId: string): string {
  const sig = createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(Buffer.from(`plan-cancel:v1:${boatId}`, 'utf8'))
    .digest('base64url')
  return `${boatId}.${sig}`
}

describe('plan cancel token', () => {
  test('matches the Node crypto HMAC-SHA256 base64url reference', async () => {
    expect(planCancelMessage(BOAT_ID)).toBe(`plan-cancel:v1:${BOAT_ID}`)
    const token = await signPlanCancelToken(SECRET, BOAT_ID)
    expect(token).toBe(nodeToken(SECRET, BOAT_ID))
    expect(token).toBe(EXPECTED_TOKEN)
    expect(token).not.toMatch(/[=+/]/)
  })

  test('builds the cancel URL from the env', async () => {
    const url = await buildPlanCancelUrl(
      BOAT_ID,
      env({ PLAN_CANCEL_SECRET: SECRET, PLAN_CANCEL_BASE_URL: 'https://pro.example.com/cancel' }),
    )
    expect(url).toBe(`https://pro.example.com/cancel/${EXPECTED_TOKEN}`)
  })

  test('returns null and warns when either env var is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await buildPlanCancelUrl(BOAT_ID, env({ PLAN_CANCEL_BASE_URL: 'https://x/cancel' }))).toBeNull()
    expect(await buildPlanCancelUrl(BOAT_ID, env({ PLAN_CANCEL_SECRET: SECRET }))).toBeNull()
    expect(await buildPlanCancelUrl(BOAT_ID)).toBeNull() // no Deno under vitest
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })
})

describe('recurring confirmation email cancel link', () => {
  const webhookSource = readFileSync(
    new URL('../supabase/functions/diving-stripe-webhook/index.ts', import.meta.url),
    'utf8',
  )

  test('signs the order boat id, recurring orders only', () => {
    expect(webhookSource).toMatch(/\.select\(`order_number, boat_id,/)
    expect(webhookSource).toMatch(
      /const planCancelUrl = isRecurring && typeof order\.boat_id === 'string' && order\.boat_id\s*\?\s*await buildPlanCancelUrl\(order\.boat_id\)/,
    )
    expect(webhookSource).toContain('const cancelLine = (isRecurring && planCancelUrl)')
    expect(webhookSource).toContain(
      'Want to stop your plan? Cancel any time: <a href="${planCancelUrl}"',
    )
  })
})
