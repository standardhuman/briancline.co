// Supabase API key resolution for edge functions.
//
// Supabase is retiring the legacy JWT API keys (anon / service_role). Edge
// functions now get the new keys injected as JSON maps:
//   SUPABASE_SECRET_KEYS       e.g. {"default":"sb_secret_..."}
//   SUPABASE_PUBLISHABLE_KEYS  e.g. {"default":"sb_publishable_..."}
// Prefer the new key (the "default" entry, else the first value) and fall back
// to the legacy single-value var so this works before, during and after the
// cutover. Never log the returned values.

export type EnvGetter = (name: string) => string | undefined

// Deno is absent under vitest; resolve lazily so the module imports cleanly.
const denoEnv: EnvGetter = (name) =>
  (globalThis as { Deno?: { env: { get(n: string): string | undefined } } }).Deno?.env.get(name)

export function firstKeyFromJson(raw: string | undefined | null, preferredName?: string): string {
  if (!raw || !raw.trim()) return ''
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return ''
  }
  let values: unknown[] = []
  if (Array.isArray(parsed)) {
    values = parsed
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    const preferred = preferredName && preferredName in obj ? [obj[preferredName]] : []
    const fallback = 'default' in obj ? [obj.default, ...Object.values(obj)] : Object.values(obj)
    values = [...preferred, ...fallback]
  }
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

// Edge functions on this project use the secret named `edge_functions`, so
// revoking an app's own secret (pro_vercel, marketplace_vercel, scripts) never
// takes them down.
export const EDGE_FUNCTIONS_SECRET_NAME = 'edge_functions'

/** Exact named entry of a SUPABASE_*_KEYS JSON map, or '' (never another entry). */
export function namedKeyFromJson(raw: string | undefined | null, name: string): string {
  if (!raw || !raw.trim()) return ''
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const v = (parsed as Record<string, unknown>)[name]
      if (typeof v === 'string') return v.trim()
    }
  } catch {
    // malformed JSON: treat as absent
  }
  return ''
}

/**
 * Server-side secret key: the `edge_functions` entry of SUPABASE_SECRET_KEYS,
 * else legacy SUPABASE_SERVICE_ROLE_KEY. Never borrows another app's secret
 * (pro_vercel, marketplace_vercel, scripts), so revoking one can't break this.
 */
export function resolveSecretKey(env: EnvGetter = denoEnv): string {
  return namedKeyFromJson(env('SUPABASE_SECRET_KEYS'), EDGE_FUNCTIONS_SECRET_NAME) ||
    (env('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
}

/** Client-safe key: SUPABASE_PUBLISHABLE_KEYS, else legacy SUPABASE_ANON_KEY. */
export function resolvePublishableKey(env: EnvGetter = denoEnv): string {
  return firstKeyFromJson(env('SUPABASE_PUBLISHABLE_KEYS')) ||
    (env('SUPABASE_ANON_KEY') ?? '').trim()
}
