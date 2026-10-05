// Signed "Cancel my plan" links for recurring diving plans.
//
// Cross-repo contract (SailorSkills Pro verifies these tokens and must stay
// byte-compatible with this file):
//   secret   PLAN_CANCEL_SECRET (same value in both projects)
//   base     PLAN_CANCEL_BASE_URL, e.g. https://<pro-host>/cancel (no trailing slash)
//   message  `plan-cancel:v1:${boatId}`   (boatId = boats.id uuid as stored, lowercase)
//   sig      base64url, RFC 4648 section 5, NO padding, of
//            HMAC-SHA256(key = UTF-8(secret), data = UTF-8(message))
//   token    `${boatId}.${sig}`
//   url      `${PLAN_CANCEL_BASE_URL}/${token}`
//
// WebCrypto only (crypto.subtle), so this runs unchanged in Deno edge functions
// and under Node/vitest. Never log the secret or a full token.

export type EnvGetter = (name: string) => string | undefined

// Deno is absent under vitest; resolve lazily so the module imports cleanly.
const denoEnv: EnvGetter = (name) =>
  (globalThis as { Deno?: { env: { get(n: string): string | undefined } } }).Deno?.env.get(name)

const encoder = new TextEncoder()

function base64UrlNoPad(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function planCancelMessage(boatId: string): string {
  return `plan-cancel:v1:${boatId}`
}

export async function signPlanCancelToken(secret: string, boatId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(planCancelMessage(boatId)))
  return `${boatId}.${base64UrlNoPad(new Uint8Array(sig))}`
}

export async function buildPlanCancelUrl(
  boatId: string,
  env: EnvGetter = denoEnv,
): Promise<string | null> {
  const secret = env('PLAN_CANCEL_SECRET') ?? ''
  const baseUrl = (env('PLAN_CANCEL_BASE_URL') ?? '').trim().replace(/\/+$/, '')
  if (!secret || !baseUrl) {
    console.warn('Plan cancel link disabled: PLAN_CANCEL_SECRET or PLAN_CANCEL_BASE_URL is not set')
    return null
  }
  if (!boatId) {
    console.warn('Plan cancel link skipped: no boat id')
    return null
  }
  return `${baseUrl}/${await signPlanCancelToken(secret, boatId)}`
}
