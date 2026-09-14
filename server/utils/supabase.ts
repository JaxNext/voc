// Server-side Supabase helpers for Nitro routes (review session, grading,
// stats). Standard CRUD must NOT go through here — the browser talks to
// PostgREST directly with the user's JWT (architecture rule 1).
//
// - getServiceSupabase: service-role client. It bypasses RLS entirely, so
//   every query MUST be scoped explicitly with the session-derived user id.
//   The service key never leaves the server (architecture rule 3).
// - requireUserId: resolves the caller's id from the cookie session or throws
//   401. Pages are guarded by auth.global.ts, but API routes re-check auth
//   themselves (architecture rule 4).

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database'

export type ServiceSupabase = SupabaseClient<Database>

const SERVICE_CLIENT_KEY = '_vocServiceSupabase'

// Narrow view over the runtime config, covering both key mappings:
// @nuxtjs/supabase maps SUPABASE_SERVICE_ROLE_KEY → supabase.secretKey, and
// nuxt.config.ts also mirrors it into supabaseServiceRoleKey.
interface VocRuntimeConfig {
  supabase?: { secretKey?: string; serviceKey?: string }
  supabaseServiceRoleKey?: string
  public: { supabase?: { url?: string }; supabaseUrl?: string }
}

export function getServiceSupabase(event: H3Event): ServiceSupabase {
  const cached = event.context[SERVICE_CLIENT_KEY] as ServiceSupabase | undefined
  if (cached) return cached

  const config = useRuntimeConfig(event) as unknown as VocRuntimeConfig
  const url = config.public.supabase?.url ?? config.public.supabaseUrl
  const serviceKey =
    config.supabase?.secretKey ?? config.supabase?.serviceKey ?? config.supabaseServiceRoleKey
  if (!url || !serviceKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Service-role Supabase client is not configured',
    })
  }

  const client = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  event.context[SERVICE_CLIENT_KEY] = client
  return client
}

// Caller's user id from the HttpOnly cookie session, or 401.
// serverSupabaseUser returns JWT claims (getClaims()) — the id lives in `sub`.
export async function requireUserId(event: H3Event): Promise<string> {
  try {
    const claims = await serverSupabaseUser(event)
    if (claims?.sub) return claims.sub
  } catch {
    // getClaims throws on malformed/expired cookies — fall through to 401.
  }
  throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
}
