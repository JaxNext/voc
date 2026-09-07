/**
 * Global auth guard.
 *
 * `@nuxtjs/supabase` is configured with `redirect: false` and therefore does
 * not register its own auth-redirect middleware — this guard fills that gap.
 * Everything outside the public whitelist redirects to /login when
 * unauthenticated.
 */
export default defineNuxtRouteMiddleware(to => {
  // Path matching is used (not fullPath) so callback URLs that append
  // ?token_hash / #access_token still resolve against the whitelist.
  if (PUBLIC_AUTH_PATHS.has(to.path)) return

  const user = useSupabaseUser()
  if (!user.value) {
    return navigateTo('/login')
  }
})
