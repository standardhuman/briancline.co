import { describe, expect, test } from 'vitest'
import {
  firstKeyFromJson,
  resolvePublishableKey,
  resolveSecretKey,
} from '../supabase/functions/_shared/supabase-keys.ts'

const env = (vars: Record<string, string | undefined>) => (name: string) => vars[name]

describe('firstKeyFromJson', () => {
  test('prefers the "default" entry', () => {
    expect(firstKeyFromJson('{"other":"sb_secret_b","default":"sb_secret_a"}')).toBe('sb_secret_a')
  })
  test('falls back to the first non-empty value', () => {
    expect(firstKeyFromJson('{"web":" sb_publishable_w "}')).toBe('sb_publishable_w')
    expect(firstKeyFromJson('["", "sb_secret_x"]')).toBe('sb_secret_x')
  })
  test('returns empty for missing or malformed input', () => {
    expect(firstKeyFromJson(undefined)).toBe('')
    expect(firstKeyFromJson('')).toBe('')
    expect(firstKeyFromJson('not json')).toBe('')
    expect(firstKeyFromJson('{}')).toBe('')
    expect(firstKeyFromJson('"sb_secret_bare"')).toBe('')
  })
})

describe('resolveSecretKey / resolvePublishableKey', () => {
  test('prefer the new JSON keys over legacy vars', () => {
    const e = env({
      SUPABASE_SECRET_KEYS: '{"default":"sb_secret_new"}',
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-service',
      SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_new"}',
      SUPABASE_ANON_KEY: 'legacy-anon',
    })
    expect(resolveSecretKey(e)).toBe('sb_secret_new')
    expect(resolvePublishableKey(e)).toBe('sb_publishable_new')
  })
  test('fall back to trimmed legacy vars when the JSON vars are absent or bad', () => {
    const e = env({
      SUPABASE_SECRET_KEYS: 'garbage',
      SUPABASE_SERVICE_ROLE_KEY: ' legacy-service\n',
      SUPABASE_ANON_KEY: 'legacy-anon',
    })
    expect(resolveSecretKey(e)).toBe('legacy-service')
    expect(resolvePublishableKey(e)).toBe('legacy-anon')
  })
  test('return empty when nothing is set', () => {
    expect(resolveSecretKey(env({}))).toBe('')
    expect(resolvePublishableKey(env({}))).toBe('')
  })
})
