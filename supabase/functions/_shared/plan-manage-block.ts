// "Manage your account" block for recurring-plan order confirmation emails.
//
// Pure string helpers (no Deno, no network), so the diving-stripe-webhook
// bundle and vitest can both import this module unchanged.
//
// Two independent pieces, each rendered only when its link exists:
//   1. Button to the boat owner's SailorSkills portal, through Pro's tracked
//      redirect (same link Pro's own emails use, click source "account"):
//        https://pro.sailorskills.com/p/<share_token>?s=account
//      which 302s to https://sailorskills.com/boat/<share_token>?src=email.
//      Needs boats.share_token. The webhook never mints a token; no token
//      means no button.
//   2. Fine print with the signed plan cancel link (plan-cancel-token.ts).
//      Kept for California auto-renewal law (easy online cancellation).
//      A null cancel URL means no fine print.
// Non-recurring orders render nothing.

export const PORTAL_REDIRECT_ORIGIN = 'https://pro.sailorskills.com'

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Customer portal URL for email links, or null when the boat has no share_token. */
export function buildPortalEmailUrl(shareToken: string | null | undefined): string | null {
  const token = typeof shareToken === 'string' ? shareToken.trim() : ''
  if (!token) return null
  return `${PORTAL_REDIRECT_ORIGIN}/p/${encodeURIComponent(token)}?s=account`
}

export interface PlanManageBlockInput {
  isRecurring: boolean
  shareToken: string | null | undefined
  planCancelUrl: string | null | undefined
}

export function renderPlanManageBlock(input: PlanManageBlockInput): string {
  if (!input.isRecurring) return ''
  const portalUrl = buildPortalEmailUrl(input.shareToken)
  const cancelUrl = typeof input.planCancelUrl === 'string' && input.planCancelUrl.trim()
    ? input.planCancelUrl.trim()
    : null
  if (!portalUrl && !cancelUrl) return ''

  const button = portalUrl
    ? `<a href="${escapeHtmlAttr(portalUrl)}" style="display:inline-block;padding:12px 28px;background-color:#1565c0;background:linear-gradient(135deg,#1565c0,#0097a7);border-radius:8px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Manage your account</a>`
    : ''
  const finePrint = cancelUrl
    ? `<p style="margin:${portalUrl ? '10px' : '0'} 0 0;font-size:12px;color:#94a3b8;">You can cancel your plan anytime <a href="${escapeHtmlAttr(cancelUrl)}" style="color:#64748b;text-decoration:underline;">here</a>.</p>`
    : ''
  return `<div style="text-align:center;margin:0 0 24px;">${button}${finePrint}</div>`
}
