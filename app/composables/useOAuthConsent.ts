// OAuth consent composable — client state for the consent screen
// (development-plan §4.4, design: docs/oauth-provider-tech-design.md §7).
// Wraps the supabase.auth.oauth.* server-API calls: fetches the authorization
// details, short-circuits already-consented requests, and forwards the user's
// approve/deny decision back to the OAuth client via the returned redirect URL.

import { computed, ref } from 'vue'
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js'

export type ConsentDecision = 'approve' | 'deny'
export type ConsentStatus = 'loading' | 'consent' | 'error'

export function useOAuthConsent() {
  const route = useRoute()
  const supabase = useSupabaseClient()

  const status = ref<ConsentStatus>('loading')
  const errorMessage = ref<string | null>(null)
  const details = ref<OAuthAuthorizationDetails | null>(null)
  // Guards double-clicks while an approve/deny round-trip is in flight.
  const pendingDecision = ref<ConsentDecision | null>(null)

  // The Supabase authorize endpoint lands here with ?authorization_id=….
  const authorizationId = computed(() =>
    typeof route.query.authorization_id === 'string' ? route.query.authorization_id : null,
  )

  // Requested scopes as a display list ("openid profile" → ['openid', 'profile']).
  const scopes = computed(() =>
    details.value ? details.value.scope.split(' ').filter(Boolean) : [],
  )

  function fail(message: string) {
    status.value = 'error'
    errorMessage.value = message
  }

  async function followRedirect(url: string) {
    await navigateTo(url, { external: true })
  }

  // Entry point — call from onMounted once the route is available.
  async function init(): Promise<void> {
    if (!authorizationId.value) {
      fail('Missing authorization request. Start again from the application.')
      return
    }
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId.value)
    if (error) {
      fail(error.message)
      return
    }
    // Already consented (or auto-approved): skip the UI, return to the client.
    if (!('authorization_id' in data)) {
      await followRedirect(data.redirect_url)
      return
    }
    details.value = data
    status.value = 'consent'
  }

  async function decide(decision: ConsentDecision): Promise<void> {
    if (!authorizationId.value || pendingDecision.value) return
    pendingDecision.value = decision
    // skipBrowserRedirect keeps the SDK from navigating on its own — the page
    // follows the returned redirect_url explicitly (design §7).
    const { data, error } =
      decision === 'approve'
        ? await supabase.auth.oauth.approveAuthorization(authorizationId.value, {
            skipBrowserRedirect: true,
          })
        : await supabase.auth.oauth.denyAuthorization(authorizationId.value, {
            skipBrowserRedirect: true,
          })
    if (error) {
      pendingDecision.value = null
      fail(error.message)
      return
    }
    await followRedirect(data.redirect_url)
  }

  return {
    status,
    errorMessage,
    details,
    pendingDecision,
    authorizationId,
    scopes,
    init,
    decide,
  }
}
