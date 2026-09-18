# OAuth Provider Tech Design: Voc as an OAuth 2.1 / OIDC Authorization Server

> Companion to [tech-design.md](./tech-design.md). This document specifies how Voc exposes
> its Supabase-backed data to third-party applications as an OAuth 2.1 / OpenID Connect
> **provider**, i.e. "Sign in with Voc".
>
> Status: **Decisions locked — pending final approval** · Target feature: Supabase OAuth 2.1 Server (beta)

---

## 1. Purpose & Scope

Voc should act as an OAuth **provider** (not a client). Third-party applications:

1. Authenticate a user against Voc's Supabase Auth ("Sign in with Voc").
2. Receive an access token bound to that user.
3. Use that token to call Supabase PostgREST and read/write that user's Voc data,
   subject to the existing Row Level Security policies.

This is distinct from adding social login _into_ Voc (e.g. Google/GitHub buttons), where
Voc would be the OAuth **client**.

## 2. Requirements (decisions locked in)

| #   | Decision            | Value                                                                 |
| --- | ------------------- | --------------------------------------------------------------------- |
| 1   | Direction           | Voc is the provider; third parties sign in with a Voc account         |
| 2   | Access type         | Real PostgREST **data access only** — no OIDC identity scopes         |
| 3   | Grant level         | **Read-write** on the user's own data, for all registered clients     |
| 4   | Client registration | General model (§8–§9); **manual only**; no concrete clients yet       |
| 5   | Production Site URL | The **Cloudflare Pages default domain** (`https://voc-9d5.pages.dev`) |
| 6   | Risk tolerance      | OK with the feature's **beta** status                                 |

## 3. Chosen Approach & Rationale

Use **Supabase's native OAuth 2.1 Server** (beta) instead of hand-rolling an
authorization server in Nitro.

- Supabase already owns identity (GoTrue), issues JWTs, and — critically — the target data
  is already protected by RLS and served through PostgREST. A custom OAuth server would
  duplicate token issuance, PKCE, JWKS, and consent logic that Supabase now ships.
- OAuth access tokens are **standard Supabase JWTs** (`sub`, `role`, `aud`), so existing
  RLS policies continue to apply unchanged. This preserves architecture rule 2
  ("RLS is the primary defense").
- The only application code Voc needs to write is the **consent/authorization UI** plus a
  small amount of auth-bounce wiring. No token endpoint, no JWKS, no grant-type code.

**Trade-off acknowledged:** the feature is in beta and the "consent screen" policy/branding
surface is thinner than a purpose-built IdP. Given requirement #5 this is accepted.

## 4. Architecture Overview

```
 Third-party app              Supabase (GoTrue/Auth)        Voc (Nuxt, this repo)
─────────────────────        ─────────────────────────        ───────────────────
│ 1. redirect user to  │      │                          │
│ /auth/v1/oauth/      │ ───► │ 2. user not signed in →  │
│ authorize?...        │      │    redirect to Site URL  │
│                      │      │    /oauth/consent        │
│                      │      │    ?authorization_id=…   │
│                      │      │ ───────────────────────► │ 3. ensure login,
│                      │      │                          │    show consent UI
│                      │      │ 4. approve/deny(        │
│                      │      │    authorization_id)     │
│                      │      │ ◄─────────────────────── │
│                      │      │                          │
│ 5. redirect_uri +    │      │                          │
│    authorization code│ ◄─── │                          │
│                      │      │                          │
│ 6. POST /auth/v1/    │ ───► │ (code + PKCE verifier)   │
│    oauth/token       │      │                          │
│ 7. access_token(JWT) │ ◄─── │                          │
│    + refresh_token   │      │                          │
│                      │      │                          │
│ 8. PostgREST REST/v1 │ ───► │ RLS: auth.uid()=user_id │ ──► Postgres
│   Authorization:     │      │   (client_id claim       │
│   Bearer <JWT>       │      │    available granularly)│
│ 9. user's Voc data   │ ◄─── │                          │
─────────────────────        ─────────────────────────        ───────────────────
```

Steps 1–7 (authorization code + PKCE, token exchange, JWKS, OIDC discovery) are implemented
entirely by Supabase. Voc owns step 3–4 (the consent page).

## 5. Supabase-provided OAuth Surface (no custom code)

Enabling OAuth 2.1 Server (Dashboard → Authentication → **OAuth Server**) exposes:

| Endpoint        | URL                                                                                |
| --------------- | ---------------------------------------------------------------------------------- |
| Authorization   | `https://<project-ref>.supabase.co/auth/v1/oauth/authorize`                        |
| Token           | `https://<project-ref>.supabase.co/auth/v1/oauth/token`                            |
| JWKS            | `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`                  |
| OAuth discovery | `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1` |
| OIDC discovery  | `https://<project-ref>.supabase.co/auth/v1/.well-known/openid-configuration`       |

- **Grants:** OAuth 2.1 authorization code + PKCE, and refresh tokens. No resource-owner
  password grant, no client-credentials grant.
- **Token claims:** every OAuth access token carries the standard Supabase claims plus a
  `client_id` claim. `sub` = `user_id` = the authorizing user's UUID.

```jsonc
{
  "sub": "user-uuid",
  "role": "authenticated",
  "aud": "authenticated",
  "user_id": "user-uuid",
  "email": "user@example.com",
  "client_id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
  // …iss, iat, exp, session_id, aal, amr
}
```

Because `sub` is the user UUID, `auth.uid()` keeps returning the resource owner and the
existing `auth.uid() = user_id` policies work unchanged for third-party tokens (§9).

## 6. Configuration & Pre-requisites

1. **Migrate JWT signing to RS256/ES256** (Dashboard → **Settings → JWT** signing keys —
   not under Authentication). Zero-downtime procedure per the Supabase signing-keys guide:
   1. _Migrate JWT secret_ — imports the legacy secret into the signing-keys system and
      creates a standby asymmetric key.
   2. _Rotate keys_ — the asymmetric key becomes current; new tokens (including OAuth
      tokens) are signed RS256/ES256 and its public key is served via JWKS.
   3. Wait ≥ access-token lifetime + buffer (1h15m at the default 1h expiry), then
      optionally _revoke_ the legacy secret. **Rotation does not force sign-out** —
      non-expired access tokens remain accepted; users are not logged out.
   - Required if any client requests the `openid` scope (ID token generation fails with
     HS256); recommended otherwise so third parties validate tokens via JWKS.
   - Before _revoking_ the legacy secret, confirm the API keys in use are the new-style
     `sb_publishable_`/`sb_secret_` keys (legacy `anon`/`service_role` keys are JWTs signed
     by the legacy secret). Voc's service key is already `sb_secret_` style; check the anon key.
2. **Site URL** (Authentication → URL Configuration): production origin is the Cloudflare
   Pages default domain `https://voc-9d5.pages.dev` (verified live).
   - **Sequencing (decided):** keep the current `http://localhost:3000` Site URL through
     local development and consent testing (4.2–4.5 local runs) — the consent target is
     always `Site URL + Authorization Path`, so localhost is what makes local consent E2E
     possible. Switch to the production origin as the **final 4.5 step** (design plan 4.5
     last item), and add `http://localhost:3000/**` (+ other dev ports, e.g. `:3004`) to
     the **Redirect URLs** allowlist so regular auth flows keep working against localhost
     afterwards.
   - While Site URL is localhost, Supabase auth emails (verification/reset) link to
     localhost — acceptable while testing from the dev machine; do not on-board real
     third-party clients until the switch is done.
3. **Set Authorization Path** to `/oauth/consent` (OAuth Server settings). The customer
   consent UI lives at `Site URL + Authorization Path`.
4. **Register clients** in Dashboard → Authentication → **OAuth Apps** (§8).

No new client-side secret is introduced: Voc still ships only `SUPABASE_URL` and
`SUPABASE_ANON_KEY` to the browser (`SUPABASE_SERVICE_ROLE_KEY` remains server-only).

## 7. Consent / Authorization UI (the only real frontend work)

The configured `Site URL + /oauth/consent` resolves to a new Nuxt route:
`app/pages/oauth/consent.vue`. Supabase redirects the user's browser here with an
`authorization_id` query parameter.

### Page behavior

1. Read `authorization_id` from the route query; if missing, show an error state.
2. Ensure the user is signed in. If not, bounce to `/login` **preserving** the
   `authorization_id` (see §7.1).
3. `supabase.auth.oauth.getAuthorizationDetails(authorization_id)` →
   `{ client: { name }, redirect_uri, scope }` (note: `scope` is a single space-separated
   string, not an array).
   - If the returned object has no `authorization_id` (already-consented) it instead carries
     a `redirect_url` — redirect the browser there immediately.
4. Render a consent screen: "**{client.name}** requests access" + the requested scopes
   (e.g. `openid email profile`) + Approve / Deny.
5. On the user's choice, call the matching method and redirect to its `redirect_url`:
   - `const { data } = await supabase.auth.oauth.approveAuthorization(authorization_id)`
   - `const { data } = await supabase.auth.oauth.denyAuthorization(authorization_id)`
   - then `await navigateTo(data.redirect_url, { external: true })`.

The approve/deny methods perform all OAuth logic internally (code issuance, error
encoding); Voc only follows the returned redirect.

> ✅ Resolved (Phase 4.1): `@supabase/supabase-js` upgraded to `^2.116.0` — the `auth.oauth`
> namespace is exposed (`getAuthorizationDetails` / `approveAuthorization` / `denyAuthorization`).
> Note: approve/deny **auto-redirect the browser by default**; pass
> `{ skipBrowserRedirect: true }` to navigate manually via `redirect_url`. See
> [4.1-oauth-sdk-verification.md](./4.1-oauth-sdk-verification.md).

### 7.1 Unauthenticated bounce — preserving `authorization_id`

Currently [auth.global.ts](file:///Users/jax/Dev/voc/app/middleware/auth.global.ts) redirects
unauthenticated users to `/login` and drops the query string. That would lose the
`authorization_id`. Required change:

- `/oauth/consent` is **not** added to `PUBLIC_AUTH_PATHS` in
  [routes.ts](file:///Users/jax/Dev/voc/app/utils/routes.ts) (the page requires a session).
- When the guard bounces an unauthenticated user away from `/oauth/consent`, it must carry
  the `authorization_id` through `/login`, e.g. `/login?redirect=/oauth/consent%3Fauthorization_id%3D…`
  (or a dedicated `authorization_id` query param).
- After login/registration, `login.vue` (and `register.vue`) must return the user to the
  preserved `/oauth/consent?authorization_id=…` rather than the default `/`.

This mirrors the pattern Supabase documents for the consent page
(`redirect('/login?redirect=/oauth/consent?authorization_id=…')`), adapted to the existing
route-guard + login flow.

## 8. Client Registration Model (general)

Clients are registered in Supabase (Dashboard → **OAuth Apps**), not in the Voc Postgres
schema — no custom `clients` table for now. Each registration captures:

- **Client name** (friendly), **Redirect URIs** (one or more, exact-match; loopback URIs
  allowed for native/CLI clients), **Client type** → auth method:
  - `public` → `token_endpoint_auth_method = none` (SPA/mobile; no secret; PKCE mandatory).
  - `confidential` → `client_secret_basic` (default) or `client_secret_post` (server-side app).
- Registration is **manual only** — dynamic client registration (MCP auto-onboarding) is
  disabled.

Scoping convention (see §9): a client's identity is its `client_id`; any per-client data
limit is expressed in RLS against the `client_id` claim, and extra JWT claims can be injected
per-client via a **Custom Access Token Hook** (optional, §9.4).

## 9. Scoping & Data Access Control

### 9.1 Scopes vs. data access — the key distinction

- OAuth **scopes** (`openid`, `email`, `profile`, `phone`) control only OIDC/UserInfo output
  (ID-token claims, `GET /auth/v1/userinfo`). They do **not** gate database access.
- **Database access** is governed by RLS and the `client_id` claim.

### 9.2 Default: read-write via existing RLS (no policy changes required)

Requirement #3 (read-write) maps cleanly onto the current schema in
[001_initial_schema.sql](file:///Users/jax/Dev/voc/supabase/migrations/001_initial_schema.sql):
every policy keys off `auth.uid() = user_id` (or an ownership subquery), and
`auth.uid()` = the authorizing user for OAuth tokens. **A third-party token therefore gets
the same user-scoped read-write as the first-party client with zero policy changes.**

### 9.3 Per-client differentiation (when concrete clients appear)

When a specific client needs narrower permissions, add a `client_id` guard to the relevant
policy. Patterns:

```sql
-- grant client X read-only access to the user's records
create policy "records readonly for client X" on public.records
  for select
  using (auth.uid() = user_id and (auth.jwt() ->> 'client_id') = '<client-id>');

-- grant client Y full read-write (idempotent with the existing owner policy)
create policy "records rw for client Y" on public.records
  for all
  using (auth.uid() = user_id and (auth.jwt() ->> 'client_id') = '<client-id>')
  with check (auth.uid() = user_id and (auth.jwt() ->> 'client_id') = '<client-id>');
```

Notes:

- RLS policies are additive (permissive OR); adding a `client_id` policy does not weaken the
  existing owner-only policies — it only grants _that_ client, still scoped to `user_id`.
- For richer permission data (per-client table grants, read/write flags) prefer a vetted
  `public.oauth_client_grants (client_id primary key, mode, allowed_tables[])` table joined in
  RLS, or inject claims via a Custom Access Token Hook. Defer until the client set is known —
  do not build this speculatively now.

### 9.4 Optional: Custom Access Token Hook

Supabase's Custom Access Token Hook fires on every token issuance including OAuth flows and
receives the `client_id`. Future use: set a custom `aud`, or embed per-client permission
claims for RLS. Not required for the read-write default.

## 10. Code / Config Change Inventory

| Area                            | Change                                                                                                | Type     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| Supabase (dashboard)            | Enable OAuth 2.1 Server; set Authorization Path `/oauth/consent`; set Site URL                        | config   |
| Supabase (dashboard)            | Migrate JWT signing to RS256/ES256 (session invalidations)                                            | config   |
| Supabase (dashboard)            | Register OAuth clients                                                                                | config   |
| `app/pages/oauth/consent.vue`   | New consent page (§7)                                                                                 | new      |
| `app/middleware/auth.global.ts` | Preserve `authorization_id` when bouncing `/oauth/consent` → `/login`                                 | edit     |
| `app/utils/routes.ts`           | Add a helper/constant for the consent path (not in `PUBLIC_AUTH_PATHS`)                               | edit     |
| `app/pages/login.vue`           | Return to `/oauth/consent?authorization_id=…` after login when a redirect is pending                  | edit     |
| `app/pages/register.vue`        | Same preserve/pending handling as login                                                               | edit     |
| `supabase/migrations/*.sql`     | None for the default read-write grant; add per-client `client_id` policies in §9.3 when clients exist | deferred |

## 11. Security Considerations

- **Beta feature** — treat as experimental; do not on-board high-trust/large-permission
  clients until it stabilizes.
- **Signing-key migration invalidates sessions** — schedule once; communicate re-login.
- **Redirect URIs must match exactly** (Supabase enforces); never accept wildcards in
  production; register `https` URIs; allow loopback only for native/CLI clients.
- **`client_id` is trustworthy** — it is set by GoTrue at token issuance, not user-controlled;
  safe to read via `auth.jwt() ->> 'client_id'` in RLS.
- **Scopes ≠ authorization** — do not treat `openid`/`email`/`phone` as data grants; enforce
  data limits purely in RLS.
- **No service-role exposure** — third parties hold only their own OAuth tokens (user-bound);
  `SUPABASE_SERVICE_ROLE_KEY` remains server-only.
- **Consent replay** — `authorization_id` resolves to a single authorization; approve/deny are
  server-mediated. The consent page must operate only in the target user's authenticated
  session (the auth guard enforces this).
- **Read-write default all clients** — since all registered clients get user-scoped read-write,
  client registration is effectively a trust decision; keep the registered set small and audit
  it. Revisit §9.3 for least-privilege when the client list grows.

## 12. Testing Plan

- **Manual happy path:** register a throwaway public client (e.g. a local web app or curl +
  PKCE) → sign in with a Voc account → consent → exchange code → call PostgREST for that
  user's `records` (read, then write), verify both succeed.
- **RLS isolation:** with two Voc users and one client, verify a token for user A cannot read
  or write user B's rows (existing policies + `client_id` guard hold).
- **Consent edge cases:** missing `authorization_id`; already-consented (`redirect_url`
  without `authorization_id`); deny path returns an error to the client `redirect_uri`;
  unauthenticated bounce preserves `authorization_id` through login.
- **Unit/component:** consent page renders client name + scopes; approve/deny call the
  correct `supabase.auth.oauth.*` method (stub the client).
- **Optional e2e:** a Playwright flow using a mock client redirect to/from the consent route.

## 13. Resolved Decisions

1. **Grant level** — all registered clients get user-scoped read-write by default; per-client
   `client_id` least-privilege is deferred until concrete clients appear (§9.3).
2. **Registration** — manual only; dynamic/MCP registration disabled.
3. **Access type** — data access only; no `openid`/`email`/`profile` scopes. RS256/ES256 is
   therefore recommended for JWKS validation, not strictly required (§6).
4. **Production Site URL** — the Cloudflare Pages default domain (`https://voc-9d5.pages.dev`);
   Authorization Path remains `/oauth/consent`. Site URL stays `http://localhost:3000`
   during development (4.2–4.5 local testing) and switches to production as the final 4.5
   step.
5. **SDK** — supabase-js `^2.116.0` exposes `supabase.auth.oauth.*`; approve/deny auto-redirect
   by default (`skipBrowserRedirect` to opt out). Verified in Phase 4.1.

## 14. References

- Supabase — [OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server)
- Supabase — [Getting Started with OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- Supabase — [Token Security & RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- Supabase — [OAuth Flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
