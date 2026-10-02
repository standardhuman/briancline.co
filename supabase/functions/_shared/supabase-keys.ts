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

export function firstKeyFromJson(raw: string | undefined | null): string {
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
    values = 'default' in obj ? [obj.default, ...Object.values(obj)] : Object.values(obj)
  }
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/** Server-side secret key: SUPABASE_SECRET_KEYS, else legacy SUPABASE_SERVICE_ROLE_KEY. */
export function resolveSecretKey(env: EnvGetter = denoEnv): string {
  return firstKeyFromJson(env('SUPABASE_SECRET_KEYS')) ||
    (env('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
}

/** Client-safe key: SUPABASE_PUBLISHABLE_KEYS, else legacy SUPABASE_ANON_KEY. */
export function resolvePublishableKey(env: EnvGetter = denoEnv): string {
  return firstKeyFromJson(env('SUPABASE_PUBLISHABLE_KEYS')) ||
    (env('SUPABASE_ANON_KEY') ?? '').trim()
}
