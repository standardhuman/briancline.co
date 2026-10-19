import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import {
  buildPortalEmailUrl,
  escapeHtmlAttr,
  renderPlanManageBlock,
} from '../supabase/functions/_shared/plan-manage-block.ts'

const SHARE_TOKEN = '0123456789abcdef0123456789abcdef'
const PORTAL_URL = `https://sailorskills.com/boat/${SHARE_TOKEN}?src=email`
const CANCEL_URL =
  'https://pro.example.com/cancel/00000000-0000-0000-0000-000000000001.U_HYGd-XbArJsRNbyDSA7a5xRNR1ZG44BakvOl4cZto'

const DASH_OR_EMOJI = /[–—]|\p{Extended_Pictographic}/u

describe('renderPlanManageBlock', () => {
  test('recurring with share_token and cancel URL renders button and fine print', () => {
    const html = renderPlanManageBlock({ isRecurring: true, shareToken: SHARE_TOKEN, planCancelUrl: CANCEL_URL })
    expect(html).toContain(`href="${PORTAL_URL}"`)
    expect(html).toContain('>Manage your account</a>')
    expect(html).toContain('You can cancel your plan anytime <a')
    expect(html).toContain(`href="${CANCEL_URL}"`)
    expect(html).toContain('>here</a>.')
    // Button comes first; fine print sits under it.
    expect(html.indexOf('Manage your account')).toBeLessThan(html.indexOf('You can cancel'))
  })

  test('no share_token: button absent, fine print present', () => {
    for (const shareToken of [null, undefined, '', '   ']) {
      const html = renderPlanManageBlock({ isRecurring: true, shareToken, planCancelUrl: CANCEL_URL })
      expect(html).not.toContain('Manage your account')
      expect(html).not.toContain('sailorskills.com/boat/')
      expect(html).toContain('You can cancel your plan anytime')
      expect(html).toContain(`href="${CANCEL_URL}"`)
    }
  })

  test('null cancel URL: button present, fine print absent', () => {
    for (const planCancelUrl of [null, undefined, '']) {
      const html = renderPlanManageBlock({ isRecurring: true, shareToken: SHARE_TOKEN, planCancelUrl })
      expect(html).toContain(`href="${PORTAL_URL}"`)
      expect(html).toContain('Manage your account')
      expect(html).not.toContain('cancel')
    }
  })

  test('recurring with neither link renders nothing', () => {
    expect(renderPlanManageBlock({ isRecurring: true, shareToken: null, planCancelUrl: null })).toBe('')
  })

  test('non-recurring renders nothing even with both links', () => {
    expect(renderPlanManageBlock({ isRecurring: false, shareToken: SHARE_TOKEN, planCancelUrl: CANCEL_URL })).toBe('')
  })

  test('no em dashes, en dashes, or emoji in any output', () => {
    const variants = [
      renderPlanManageBlock({ isRecurring: true, shareToken: SHARE_TOKEN, planCancelUrl: CANCEL_URL }),
      renderPlanManageBlock({ isRecurring: true, shareToken: null, planCancelUrl: CANCEL_URL }),
      renderPlanManageBlock({ isRecurring: true, shareToken: SHARE_TOKEN, planCancelUrl: null }),
    ]
    for (const html of variants) {
      expect(html.length).toBeGreaterThan(0)
      expect(html).not.toMatch(DASH_OR_EMOJI)
    }
  })

  test('escapes attribute values', () => {
    const html = renderPlanManageBlock({
      isRecurring: true,
      shareToken: 'a"b<c',
      planCancelUrl: 'https://x.test/cancel/t?a=1&b="2"<script>',
    })
    expect(html).toContain('href="https://sailorskills.com/boat/a%22b%3Cc?src=email"')
    expect(html).toContain('href="https://x.test/cancel/t?a=1&amp;b=&quot;2&quot;&lt;script&gt;"')
    expect(html).not.toContain('<script>')
  })
})

describe('buildPortalEmailUrl / escapeHtmlAttr', () => {
  test('portal URL uses share_token and src=email', () => {
    expect(buildPortalEmailUrl(` ${SHARE_TOKEN} `)).toBe(PORTAL_URL)
    expect(buildPortalEmailUrl(null)).toBeNull()
  })

  test('escapeHtmlAttr covers quotes, angle brackets, ampersands', () => {
    expect(escapeHtmlAttr(`&"'<>`)).toBe('&amp;&quot;&#39;&lt;&gt;')
  })
})

describe('diving-stripe-webhook wiring', () => {
  const webhookSource = readFileSync(
    new URL('../supabase/functions/diving-stripe-webhook/index.ts', import.meta.url),
    'utf8',
  )

  test('selects boat share_token and renders the shared block, not the old cancel line', () => {
    expect(webhookSource).toContain('boat:boat_id ( name, length, make, model, share_token )')
    expect(webhookSource).toContain("from '../_shared/plan-manage-block.ts'")
    expect(webhookSource).toContain('renderPlanManageBlock({ isRecurring, shareToken, planCancelUrl })')
    expect(webhookSource).not.toContain('Cancel my plan</a>')
  })
})
