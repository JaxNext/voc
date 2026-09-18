// Mock third-party OAuth client for the 4.5 end-to-end verification
// (development-plan §Phase 4.5). Zero-dependency Node script standing in for
// "some other app" that signs in users with a Voc account:
//
//   GET /start    → PKCE + state, redirect to the Supabase authorize endpoint
//   GET /callback → receives ?code= (or ?error= on deny), exchanges the code
//                   at /auth/v1/oauth/token, then reads AND writes the user's
//                   records via PostgREST with the resulting access token
//
// Run: node scripts/oauth-mock-client.mjs   (Voc dev server must run on :3000)
// Open: http://localhost:6543/

import { createServer } from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

// --- Configuration -----------------------------------------------------------

// .env is parsed by hand to stay dependency-free; both values are public
// (anon/publishable key + project URL), safe to run from a test script.
function loadEnv() {
  const env = {}
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

const { SUPABASE_URL: SB_URL, SUPABASE_ANON_KEY: ANON_KEY } = loadEnv()
if (!SB_URL || !ANON_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const CLIENT_ID = '9b5a1ba3-4b09-4e45-9e92-279bfd401555'
const REDIRECT_URI = 'http://localhost:6543/callback'
const PORT = 6543

// --- PKCE + state ------------------------------------------------------------

const base64url = (buf) => buf.toString('base64url')

function makePkce() {
  const verifier = base64url(randomBytes(32)) // 43 chars of [A-Za-z0-9-._~]
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

// state → { verifier, issuedAt }; single-use, 10-minute expiry.
const pending = new Map()

// --- Helpers -----------------------------------------------------------------

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1rem; color: #111; }
  h1 { font-size: 1.4rem; } h2 { font-size: 1.05rem; margin-top: 2rem; }
  pre { background: #f4f4f5; padding: 0.75rem; border-radius: 8px; overflow-x: auto; font-size: 0.8rem; }
  code { background: #f4f4f5; padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.85em; }
  .ok { color: #067647; } .err { color: #b42318; }
  a.button { display: inline-block; background: #111; color: #fff; padding: 0.6rem 1.2rem; border-radius: 8px; text-decoration: none; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  td, th { border: 1px solid #e4e4e7; padding: 0.35rem 0.5rem; text-align: left; }
  th { background: #fafafa; }
</style>
</head>
<body>${body}</body>
</html>`
}

async function exchangeCode(code, verifier) {
  const res = await fetch(`${SB_URL}/auth/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  })
  return { status: res.status, json: await res.json() }
}

function decodeJwtPayload(token) {
  const [, payload] = token.split('.')
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
}

// PostgREST read: the user's 5 most recent records.
async function readRecords(accessToken) {
  const url = `${SB_URL}/rest/v1/records?select=id,type,content,meaning,created_at&order=created_at.desc&limit=5`
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
  })
  return { status: res.status, json: await res.json() }
}

// PostgREST write: insert one record owned by the token's user (user_id is
// supplied by the client and validated by the RLS with-check policy, exactly
// like app/composables/useRecords.ts does).
async function writeRecord(accessToken, sub) {
  const res = await fetch(`${SB_URL}/rest/v1/records`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      user_id: sub,
      type: 'sentence',
      content: `OAuth E2E write test — ${new Date().toISOString()}`,
      meaning: 'Inserted by scripts/oauth-mock-client.mjs via PostgREST',
    }),
  })
  return { status: res.status, json: await res.json() }
}

// --- Server ------------------------------------------------------------------

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(
      page(
        'Mock third-party app',
        `<h1>Mock third-party app</h1>
         <p>Stands in for "some other app" that signs in with a Voc account and
         reads/writes the user's Voc data through PostgREST.</p>
         <p><a class="button" href="/start">Sign in with Voc</a></p>
         <p><small>client_id <code>${CLIENT_ID}</code><br/>
         redirect_uri <code>${REDIRECT_URI}</code></small></p>`,
      ),
    )
    return
  }

  if (url.pathname === '/start') {
    const { verifier, challenge } = makePkce()
    const state = base64url(randomBytes(16))
    pending.set(state, { verifier, issuedAt: Date.now() })
    const authorizeUrl = new URL('/auth/v1/oauth/authorize', SB_URL)
    authorizeUrl.search = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    }).toString()
    res.writeHead(302, { Location: authorizeUrl.toString() })
    res.end()
    return
  }

  if (url.pathname === '/callback') {
    const error = url.searchParams.get('error')
    if (error) {
      // Deny path: the OAuth error surfaced by the client's redirect URI.
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        page(
          'Authorization denied',
          `<h1>Authorization result</h1>
           <p class="err">The user denied the request (expected on the deny path).</p>
           <pre>error = ${error}
error_description = ${url.searchParams.get('error_description') ?? '—'}
state = ${url.searchParams.get('state') ?? '—'}</pre>`,
        ),
      )
      return
    }

    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const entry = state && pending.get(state)
    if (!code || !entry || Date.now() - entry.issuedAt > 10 * 60 * 1000) {
      pending.delete(state)
      res.writeHead(400, { 'Content-Type': 'text/html' })
      res.end(page('Callback error', '<h1>Callback error</h1><p class="err">Missing/unknown state or code.</p>'))
      return
    }
    pending.delete(state) // single-use

    const token = await exchangeCode(code, entry.verifier)
    if (token.status !== 200) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        page('Token exchange failed', `<h1>Token exchange failed</h1><pre>${JSON.stringify(token.json, null, 2)}</pre>`),
      )
      return
    }

    const claims = decodeJwtPayload(token.json.access_token)
    const read = await readRecords(token.json.access_token)
    const write = await writeRecord(token.json.access_token, claims.sub)

    const readRows = Array.isArray(read.json)
      ? read.json
          .map(
            (r) =>
              `<tr><td>${r.type}</td><td>${String(r.content).slice(0, 60)}</td><td>${String(r.meaning ?? '').slice(0, 40)}</td></tr>`,
          )
          .join('')
      : ''
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(
      page(
        'OAuth result',
        `<h1>OAuth result</h1>
         <p class="ok">✅ Token exchange OK (expires_in ${token.json.expires_in}s, refresh token ${token.json.refresh_token ? 'received' : 'missing'}).</p>

         <h2>Access-token claims</h2>
         <pre>${JSON.stringify(claims, null, 2)}</pre>

         <h2>PostgREST read <span class="${read.status === 200 ? 'ok' : 'err'}">HTTP ${read.status}</span></h2>
         ${read.status === 200 ? `<table><tr><th>type</th><th>content</th><th>meaning</th></tr>${readRows}</table>` : `<pre>${JSON.stringify(read.json, null, 2)}</pre>`}

         <h2>PostgREST write <span class="${write.status === 201 ? 'ok' : 'err'}">HTTP ${write.status}</span></h2>
         <pre>${JSON.stringify(write.json, null, 2)}</pre>

         <p><small>access_token: <code>${token.json.access_token.slice(0, 40)}…</code></small></p>
         <p><a href="/">Start over</a></p>`,
      ),
    )
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/html' })
  res.end(page('404', '<h1>404</h1>'))
}).listen(PORT, () => {
  console.log(`Mock OAuth client ready → http://localhost:${PORT}/`)
  console.log(`Supabase: ${SB_URL}`)
  console.log(`client_id: ${CLIENT_ID}`)
  console.log(`redirect_uri: ${REDIRECT_URI}`)
})
