import { describe, it, expect } from 'vitest'
import { OAUTH_CONSENT_PATH, PUBLIC_AUTH_PATHS, sanitizeInternalRedirect } from '~/utils/routes'

describe('sanitizeInternalRedirect', () => {
  it('accepts same-origin absolute paths, including query strings', () => {
    expect(sanitizeInternalRedirect('/')).toBe('/')
    expect(sanitizeInternalRedirect('/oauth/consent?authorization_id=abc123')).toBe(
      '/oauth/consent?authorization_id=abc123',
    )
  })

  it('rejects external and protocol-relative URLs', () => {
    expect(sanitizeInternalRedirect('https://evil.com')).toBeNull()
    expect(sanitizeInternalRedirect('http://evil.com')).toBeNull()
    expect(sanitizeInternalRedirect('//evil.com')).toBeNull()
    expect(sanitizeInternalRedirect('javascript:alert(1)')).toBeNull()
  })

  it('rejects backslash paths and non-string input', () => {
    expect(sanitizeInternalRedirect('/\\evil.com')).toBeNull()
    expect(sanitizeInternalRedirect(null)).toBeNull()
    expect(sanitizeInternalRedirect(undefined)).toBeNull()
    // Repeated query params yield arrays — rejected rather than guessed.
    expect(sanitizeInternalRedirect(['/oauth/consent'])).toBeNull()
  })

  it('exposes the consent path separate from the public whitelist', () => {
    expect(OAUTH_CONSENT_PATH).toBe('/oauth/consent')
    expect(PUBLIC_AUTH_PATHS.has(OAUTH_CONSENT_PATH)).toBe(false)
  })
})
