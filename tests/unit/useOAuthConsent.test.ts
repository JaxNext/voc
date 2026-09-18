// useOAuthConsent composable tests (development-plan §4.4). Nuxt auto-imports
// (useRoute, useSupabaseClient, navigateTo) are stubbed with vi.fn globals and
// supabase.auth.oauth speaks the SDK contract: { data, error } results, the
// details/redirect union on getAuthorizationDetails, { skipBrowserRedirect }
// options, and a final { redirect_url } on approve/deny.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOAuthConsent } from '~/composables/useOAuthConsent'

// Minimal Nuxt useRoute: a configurable query object per test.
const route = { query: {} as Record<string, unknown> }
vi.stubGlobal('useRoute', () => route)

// Shape of a supabase.auth.oauth.* result ({ data, error } envelope).
type OAuthResult = { data: unknown; error: { message: string } | null }

const oauthMock = {
  getAuthorizationDetails: vi.fn<(id: string) => Promise<OAuthResult>>(),
  approveAuthorization:
    vi.fn<(id: string, opts?: { skipBrowserRedirect?: boolean }) => Promise<OAuthResult>>(),
  denyAuthorization:
    vi.fn<(id: string, opts?: { skipBrowserRedirect?: boolean }) => Promise<OAuthResult>>(),
}
vi.stubGlobal('useSupabaseClient', () => ({ auth: { oauth: oauthMock } }))

const navigateToMock = vi.fn<(url: string, opts?: Record<string, unknown>) => Promise<unknown>>()
vi.stubGlobal('navigateTo', navigateToMock)

const DETAILS = {
  authorization_id: 'authz-1',
  redirect_uri: 'http://localhost:3000/callback',
  client: { id: 'client-1', name: 'Test App', uri: '', logo_uri: '' },
  user: { id: 'user-1', email: 'user@example.com' },
  scope: 'openid profile',
}

beforeEach(() => {
  route.query = {}
  navigateToMock.mockReset()
  oauthMock.getAuthorizationDetails.mockReset()
  oauthMock.approveAuthorization.mockReset()
  oauthMock.denyAuthorization.mockReset()
})

describe('useOAuthConsent', () => {
  it('init shows an error state when authorization_id is missing', async () => {
    const consent = useOAuthConsent()

    await consent.init()

    expect(consent.status.value).toBe('error')
    expect(consent.errorMessage.value).toMatch(/missing authorization/i)
    expect(oauthMock.getAuthorizationDetails).not.toHaveBeenCalled()
  })

  it('init surfaces SDK errors in the error state', async () => {
    route.query = { authorization_id: 'authz-1' }
    oauthMock.getAuthorizationDetails.mockResolvedValue({
      data: null,
      error: { message: 'authorization not found' },
    })
    const consent = useOAuthConsent()

    await consent.init()

    expect(consent.status.value).toBe('error')
    expect(consent.errorMessage.value).toBe('authorization not found')
    expect(oauthMock.getAuthorizationDetails).toHaveBeenCalledWith('authz-1')
  })

  it('init redirects immediately when the user already consented', async () => {
    route.query = { authorization_id: 'authz-1' }
    oauthMock.getAuthorizationDetails.mockResolvedValue({
      data: { redirect_url: 'http://localhost:3000/callback?code=x' },
      error: null,
    })
    const consent = useOAuthConsent()

    await consent.init()

    expect(navigateToMock).toHaveBeenCalledWith('http://localhost:3000/callback?code=x', {
      external: true,
    })
    expect(consent.status.value).toBe('loading')
    expect(consent.details.value).toBeNull()
  })

  it('init loads the details and exposes the parsed scope list', async () => {
    route.query = { authorization_id: 'authz-1' }
    oauthMock.getAuthorizationDetails.mockResolvedValue({ data: DETAILS, error: null })
    const consent = useOAuthConsent()

    await consent.init()

    expect(consent.status.value).toBe('consent')
    expect(consent.details.value?.client.name).toBe('Test App')
    expect(consent.scopes.value).toEqual(['openid', 'profile'])
  })

  it('scopes drops empty segments from repeated spaces', async () => {
    route.query = { authorization_id: 'authz-1' }
    oauthMock.getAuthorizationDetails.mockResolvedValue({
      data: { ...DETAILS, scope: 'openid  profile' },
      error: null,
    })
    const consent = useOAuthConsent()

    await consent.init()

    expect(consent.scopes.value).toEqual(['openid', 'profile'])
  })

  it('decide("approve") calls approveAuthorization and follows the redirect', async () => {
    route.query = { authorization_id: 'authz-1' }
    oauthMock.getAuthorizationDetails.mockResolvedValue({ data: DETAILS, error: null })
    oauthMock.approveAuthorization.mockResolvedValue({
      data: { redirect_url: 'http://localhost:3000/callback?code=ok&state=s' },
      error: null,
    })
    const consent = useOAuthConsent()
    await consent.init()

    await consent.decide('approve')

    expect(oauthMock.approveAuthorization).toHaveBeenCalledWith('authz-1', {
      skipBrowserRedirect: true,
    })
    expect(navigateToMock).toHaveBeenCalledWith('http://localhost:3000/callback?code=ok&state=s', {
      external: true,
    })
  })

  it('decide("deny") calls denyAuthorization and follows its redirect', async () => {
    route.query = { authorization_id: 'authz-1' }
    oauthMock.getAuthorizationDetails.mockResolvedValue({ data: DETAILS, error: null })
    oauthMock.denyAuthorization.mockResolvedValue({
      data: { redirect_url: 'http://localhost:3000/callback?error=access_denied' },
      error: null,
    })
    const consent = useOAuthConsent()
    await consent.init()

    await consent.decide('deny')

    expect(oauthMock.denyAuthorization).toHaveBeenCalledWith('authz-1', {
      skipBrowserRedirect: true,
    })
    expect(oauthMock.approveAuthorization).not.toHaveBeenCalled()
    expect(navigateToMock).toHaveBeenCalledWith(
      'http://localhost:3000/callback?error=access_denied',
      { external: true },
    )
  })

  it('decide surfaces SDK errors and clears the pending state', async () => {
    route.query = { authorization_id: 'authz-1' }
    oauthMock.getAuthorizationDetails.mockResolvedValue({ data: DETAILS, error: null })
    oauthMock.approveAuthorization.mockResolvedValue({
      data: null,
      error: { message: 'expired' },
    })
    const consent = useOAuthConsent()
    await consent.init()

    await consent.decide('approve')

    expect(consent.status.value).toBe('error')
    expect(consent.errorMessage.value).toBe('expired')
    expect(consent.pendingDecision.value).toBeNull()
  })

  it('decide is a no-op without an authorization request', async () => {
    const consent = useOAuthConsent()

    await consent.decide('approve')

    expect(oauthMock.approveAuthorization).not.toHaveBeenCalled()
    expect(navigateToMock).not.toHaveBeenCalled()
  })
})
