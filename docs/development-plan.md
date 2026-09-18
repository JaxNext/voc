# Development Plan: Vocabulary Capture & Review Web App (Voc)

This document outlines the actionable, step-by-step engineering roadmap to implement the **Voc** web application based on [product-design.md](./product-design.md) and [tech-design.md](./tech-design.md).

---

## 1. Overview & Phasing Strategy

Following product & architecture specifications, development is structured into 5 sequential phases:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Phase 0: Setup  │ ──> │   Phase 1: MVP  │ ──> │   Phase 2: V2   │ ──> │   Phase 3: V3   │
│ Infra, DB & CI  │     │ CRUD & Auth     │     │ SRS & Stats     │     │ Polish & Export │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **Phase 0: Foundation & Toolchain Setup** — Tooling, linting, tests, Supabase DB schema/migrations, basic project structure.
- **Phase 1: MVP (Capture, Organize, Auth)** — Authentication with email verification & password reset, Direct Supabase PostgREST CRUD with RLS, Tagging system, Record list with search, filter, and sorting.
- **Phase 2: V2 (Review & Habits)** — Nitro review session builder & grading API, pure SRS algorithm logic (`srs.ts`), Flashcard flow, session summary, and basic stats dashboard (streaks & counts).
- **Phase 3: V3 (Refinement & Portability)** — Refined SRS algorithm, device-TTS pronunciation, JSON export, Word-of-the-day / random pick, advanced statistics, PWA install prompt & offline shell polish.
- **Phase 4: OAuth Provider** — Voc as an OAuth 2.1 provider on Supabase's native OAuth Server (beta): consent UI, auth-flow plumbing, manual client registration, user-scoped read-write third-party access under existing RLS.

---

## 2. Detailed Task Breakdown

### Phase 0: Foundation & Toolchain Setup

#### 0.1 Toolchain & Config

- [x] Configure `nuxt.config.ts`:
  - Register `@nuxt/ui`, `@nuxtjs/supabase`, `@vite-pwa/nuxt`.
  - Configure Nitro preset for Cloudflare Pages: `nitro: { preset: 'cloudflare_pages' }`.
  - Setup runtime config for Supabase public keys & session secrets.
- [x] Setup VoidZero toolchain & testing:
  - Add `oxlint` configuration and lint scripts (`pnpm lint`).
  - Add `prettier` configuration and format scripts (`pnpm format`).
  - Add `vitest` and `@vue/test-utils` for unit and component testing (`pnpm test`).
  - Set up pre-commit checking (`lint-staged`).
- [x] PWA & Asset shell:
  - Configure PWA manifest in `nuxt.config.ts` (icons, theme color, display standalone).
  - Add icon placeholders in `public/icons/` (192px, 512px, maskable) and `public/favicon.ico`.

#### 0.2 Database & RLS Schema (Supabase)

- [x] Create initial SQL migration (`supabase/migrations/001_initial_schema.sql`):
  - Enums: `record_type ('word', 'phrase', 'sentence')`, `learning_status ('new', 'learning', 'mastered')`, `grade ('forgot', 'hazy', 'know', 'easy')`.
  - Tables: `records`, `tags`, `record_tags`, `review_states`, `review_events`.
  - Indexes:
    - `idx_records_user_created` on `records(user_id, created_at desc)`
    - `idx_review_due` on `review_states(next_review_at) where status <> 'mastered'`
    - `idx_events_user_date` on `review_events(user_id, reviewed_at)`
- [x] Apply Row Level Security (RLS) policies:
  - `records`: user owns records (`auth.uid() = user_id`).
  - `tags`: predefined tags readable by all (`is_predefined = true`), custom tags owned by creator (`auth.uid() = user_id`).
  - `record_tags`: scoped to owned records.
  - `review_states` & `review_events`: user-owned records and event rows only.
- [x] Seed script for predefined tags:
  - Add standard tags: `work`, `daily`, `idiom`, `travel`.

#### 0.3 Types & Shared Schemas

- [x] Create `app/types/database.ts` (generate or declare Supabase DB types).
- [x] Create `app/types/records.ts` with Zod validation schemas for:
  - `RecordInputSchema` (content, type, meaning, source, notes, tagIds).
  - `TagInputSchema`.
  - `ReviewGradeSchema`.

---

### Phase 1: MVP (Capture, Organize & Auth)

#### 1.1 Authentication & Shell

- [x] Implement global auth guard `app/middleware/auth.global.ts`:
  - Allow access to public routes: `/login`, `/register`, `/reset-password`, `/verify-email`.
  - Redirect unauthenticated users to `/login`.
- [x] Create Auth Pages:
  - `app/pages/login.vue`: Email & password sign-in form with validation, link to register and password reset.
  - `app/pages/register.vue`: Sign-up form with password criteria, redirect to verify-email.
  - `app/pages/verify-email.vue`: Instruction notice + verification callback handler.
  - `app/pages/reset-password.vue`: Password recovery request & token-based password update form.
- [x] Build Main App Shell:
  - `app/app.vue`: Toast provider, layout container, mobile-first responsive wrapper.
  - `app/components/AppBottomNav.vue`: Navigation tabs (Records, Review, Quick Add (+), Stats, Me) visible on mobile.

#### 1.2 Tag Management Composable & Components

- [x] Composable `app/composables/useTags.ts`:
  - Fetch predefined tags and user's custom tags.
  - Create custom tag, delete custom tag.
- [x] Component `app/components/TagPicker.vue`:
  - Chip-based selector for record forms and filters.
  - Inline option to create a new custom tag.
- [x] Page `app/pages/tags.vue`:
  - List predefined tags (read-only) and custom tags (with delete option).

#### 1.3 Record Capture & Editing (CRUD)

- [x] Composable `app/composables/useRecords.ts`:
  - Direct PostgREST query client using user auth token.
  - Fetch records (paginated, sorted, filtered by type & tags, text search on content & meaning).
  - Create record (inserts into `records`, tags into `record_tags`, and initializes `review_states`).
  - Update record & tag associations.
  - Delete record (cascading deletes `record_tags` and `review_states`).
- [x] Component `app/components/RecordForm.vue`:
  - Unified form for create and edit.
  - Fields: `type` (Word/Phrase/Sentence chips), `content`, `meaning`, `source`, `notes`, `TagPicker`.
  - Client-side validation via Zod.
- [x] Pages:
  - `app/pages/records/new.vue`: New record entry page.
  - `app/pages/records/[id].vue`: Record detail view with edit/delete actions.

#### 1.4 Record List & Search / Filter UX

- [x] Component `app/components/RecordCard.vue`:
  - Displays content, type badge, meaning, tags, and relative time (`2d ago`).
  - Mobile tap target linking to `/records/[id]`.
- [x] Page `app/pages/index.vue`:
  - Header with quick add action button.
  - Search input (debounced keyword search across `content` and `meaning`).
  - Filter bar: Type chips (`All`, `Word`, `Phrase`, `Sentence`), active tag filter row.
  - Sort selector (`Newest`, `Oldest`, `Alphabetical`).
  - Empty states for no records and no search results.
  - Infinite scroll / pagination loading indicator.

#### 1.5 Me / Settings (Basic)

- [x] Page `app/pages/settings.vue`:
  - Display current user profile/email and membership date.
  - Links to Tag management.
  - Logout action (clears cookie session and redirects to `/login`).

---

### Phase 2: V2 (Structured Memorization & Habits)

#### 2.1 SRS Interval Math & Server Routes

- [x] Server utility `server/utils/srs.ts`:
  - Pure function `calculateNextReview(currentInterval, consecutivePass, grade)`:
    - `forgot` -> interval resets to 1, status stays `learning`.
    - `hazy` -> interval halved (`Math.max(1, Math.round(current / 2))`).
    - `know` -> step up along ladder (`0, 1, 3, 7, 14, 30`).
    - `easy` -> accelerated jump (`Math.min(30, Math.round(current * 3))`).
    - 3 consecutive `know`/`easy` passes mark record as `mastered`.
  - Comprehensive unit test suite in `tests/server/srs.test.ts`.
- [x] Server utility `server/utils/supabase.ts`:
  - Service-role Supabase client helper for secure backend-only mutations.
- [x] Nitro API route `server/api/review/session.get.ts`:
  - Verify caller session via auth token.
  - Fetch up to $N$ (default 10) due items (`next_review_at <= now()`, status not `mastered`).
  - Shuffle items to avoid memorization order bias.
- [x] Nitro API route `server/api/review/grade.post.ts`:
  - Validate body: `{ record_id: string, grade: 'forgot'|'hazy'|'know'|'easy' }`.
  - Compute new interval and status via `srs.ts`.
  - Execute transaction: update `review_states` and append to `review_events`.

#### 2.2 Review UI & Session Flow

- [x] Composable `app/composables/useReview.ts`:
  - State management for active review queue, current index, session grades, and API synchronization.
- [x] Component `app/components/Flashcard.vue`:
  - Front view (production recall): Meaning + type indicator, "Show expression" button.
  - Back view: recorded Content, plus source, notes, tags for context.
  - 4 one-tap grade buttons: `Forgot`, `Hazy`, `Know`, `Easy`.
  - Smooth card flip/slide transitions.
- [x] Pages:
  - `app/pages/review/index.vue`:
    - Today's review queue summary: "N items due today".
    - "Start Review Session" button.
    - Zero-state when queue is clear ("All caught up! 🎉").
  - `app/pages/review/session.vue`:
    - Progress header (`X / N` items, exit button).
    - Active `Flashcard.vue` interaction.
    - Session Summary screen upon completion:
      - Breakdown of grades (`Forgot`, `Hazy`, `Know`, `Easy`).
      - New vs. Mastered items count.
      - "Done" (back to queue) and "Review Again" actions.

#### 2.3 Stats & Progress Tracking

- [x] Nitro API route `server/api/stats.get.ts`:
  - Aggregations: Total records count, learning count, mastered count.
  - Streak calculation: consecutive distinct active review dates ending today/yesterday.
  - Weekly review activity (counts per day for the last 7 days).
- [x] Page `app/pages/stats.vue`:
  - Streak badge with flame icon (`🔥 5-day streak`).
  - KPI cards: Total, Learning, Mastered.
  - Due today callout with direct "Start review" CTA.
  - Weekly activity histogram / dot grid.

---

### Phase 3: V3 (Refinement, Portability & Advanced Features)

#### 3.1 Data Portability (JSON Export)

- [ ] Page `app/pages/settings/export.vue` (or modal in `settings.vue`):
  - Fetches all user records with their associated tags and review histories.
  - Formats as JSON payload.
  - Browser trigger to download `voc-export-[date].json`.

#### 3.2 Algorithm & Queue Refinements

- [ ] Support custom session sizes (e.g. 5, 10, 20 items per session).
- [ ] Filter review sessions by tag or record type (e.g., "Review only Idioms").
- [ ] "Random Pick / Word of the Day" widget on the Home page.

#### 3.3 Pronunciation (Device TTS)

- [x] Composable `app/composables/useSpeech.ts`:
  - Wrap `window.speechSynthesis`: `speak(content)`, `stop()`, and an SSR-safe `supported` flag.
  - Reactive device voice list from `getVoices()` (refresh on `voiceschanged` — the first call can return empty).
  - Voice resolution: user-saved voiceURI (localStorage `voc:tts-voice`) if still installed -> first `en-*` voice -> `lang: 'en-US'`; playback speed from localStorage `voc:tts-rate` (0.5-2x, default 1x) applied as `utterance.rate`.
  - Cancel speech on unmount and before each new utterance (no audio bleed across flashcards).
  - Unit tests against a stubbed `speechSynthesis` (`tests/unit/useSpeech.test.ts`).
- [x] Settings voice picker (`app/pages/settings.vue`):
  - "Pronunciation voice" row with a selector listing the device's `en-*` voices and a Test preview button.
  - Speed slider (0.5-2x) next to the picker, applied live to Test and future playback.
  - Persist both choices in localStorage — per-device by design (installed voices differ across devices).
- [x] Wire the 🔊 button into surfaces:
  - `app/pages/records/[id].vue`: play button on the detail view content card.
  - `app/components/Flashcard.vue`: play button on the back/reveal view only — never the recall front.
  - Hide the button when the browser does not support speech synthesis.

#### 3.4 PWA Offline Resilience & Deployment Optimization

- [ ] Service worker offline caching polish:
  - App shell precaching.
  - UI banner displaying offline status when disconnected.
- [ ] Settings page install button:
  - Capture `beforeinstallprompt` event and trigger native install prompt.
- [ ] Cloudflare Pages build validation:
  - Verify edge bundle size and cold start performance.

---

### Phase 4: OAuth Provider (Third-party Data Access)

> Design & locked decisions: [oauth-provider-tech-design.md](./oauth-provider-tech-design.md).
> Voc acts as an OAuth 2.1 **provider** via Supabase's native OAuth Server (beta): third-party
> apps sign users in with their Voc account and get user-scoped **read-write** PostgREST access,
> governed by the existing RLS policies. Supabase owns the protocol machinery (authorize /
> token / JWKS); Voc implements only the consent UI and auth-flow plumbing.

#### 4.1 Prerequisites & SDK Verification

- [x] Verify `@supabase/supabase-js` exposes `supabase.auth.oauth.*` (`getAuthorizationDetails` / `approveAuthorization` / `denyAuthorization`) — the pinned `^2.112.4` predates it; upgrade supabase-js (check `@nuxtjs/supabase` compatibility) or fall back to direct GoTrue HTTP calls in the consent page. → Resolved: upgraded to `^2.116.0`; namespace confirmed (see docs/4.1-oauth-sdk-verification.md).
- [x] Confirm production Site URL `https://voc-9d5.pages.dev` (Dashboard → Authentication → URL Configuration). → Confirmed: domain live. Sequencing (user decision): keep `http://localhost:3000` as Site URL through local dev/consent testing (4.2–4.5), switch to the production origin + `http://localhost:3000/**` Redirect-URL allowlist as the final 4.5 step.

#### 4.2 Supabase Project Configuration (dashboard, manual)

- [x] Migrate JWT signing keys to RS256/ES256 (Dashboard → **Settings → JWT** signing keys — not under Authentication) — recommended so third parties validate tokens via JWKS. Zero downtime: _Migrate JWT secret_ → _Rotate keys_ → wait ~1h15m → optionally revoke legacy secret; rotation does **not** force sign-out (design §6). → Done: ES256 (EC P-256) confirmed live via JWKS.
- [x] Enable OAuth 2.1 Server (Authentication → OAuth Server) and set Authorization Path to `/oauth/consent`; keep dynamic client registration disabled (manual registration only). → Done: discovery endpoint serving authorize/token metadata (see docs/4.2-oauth-server-config.md).
- [x] Register the first test OAuth client: type `public` (`token_endpoint_auth_method: none`), exact redirect URI (e.g. `http://localhost:<port>/callback`), record the `client_id`. → Done: `client_id 9b5a1ba3-4b09-4e45-9e92-279bfd401555` (public client).

#### 4.3 Consent Route & Auth-flow Plumbing

- [x] `app/utils/routes.ts`: export an `OAUTH_CONSENT_PATH = '/oauth/consent'` constant — deliberately **not** added to `PUBLIC_AUTH_PATHS` (the page requires a session). → Done: [routes.ts](file:///Users/jax/Dev/voc/app/utils/routes.ts); lint + 105/105 tests pass.
- [x] `app/middleware/auth.global.ts`: when an unauthenticated user hits the consent path, redirect to `/login?redirect=/oauth/consent?authorization_id=…` so the flow survives the bounce (design §7.1). → Done: uses `to.fullPath` encoded as the `redirect` param; other protected routes keep the plain `/login` bounce.
- [x] `app/pages/login.vue`: after login, honor a same-origin `redirect` query param (strict open-redirect guard — internal paths only), otherwise default `/`. → Done: `sanitizeInternalRedirect` helper in [routes.ts](file:///Users/jax/Dev/voc/app/utils/routes.ts) (rejects external, `//`, `\`, non-string); "Create one" link preserves the pending flow into `/register?redirect=…`.
- [x] `app/pages/register.vue`: same preserve-and-return handling as login. → Done: honors `?redirect=` after auto-confirmed signup; the flow also survives the email-verification detour (`redirect` rides along in `/verify-email?…`, `emailRedirectTo`, and is honored by [verify-email.vue](file:///Users/jax/Dev/voc/app/pages/verify-email.vue)); "Log in" link preserves the pending flow.
- [x] `app/app.vue`: hide the bottom nav on the consent route (extend the mechanism that hides it on `PUBLIC_AUTH_PATHS`). → Done: `isFullscreenRoute` = public auth paths **or** consent path; consent keeps its session requirement (guard unchanged), it only shares the full-screen presentation.

#### 4.4 Consent Page `app/pages/oauth/consent.vue`

- [x] Read `authorization_id` from the route query; render an error state when missing/invalid. → Done: [useOAuthConsent.ts](file:///Users/jax/Dev/voc/app/composables/useOAuthConsent.ts) `init()`; page renders a `UAlert` error state.
- [x] Fetch `getAuthorizationDetails(authorization_id)`; render client name, redirect URI, and requested scopes (single space-separated string). If the response carries `redirect_url` without `authorization_id` (user already consented), redirect the browser there immediately. → Done: details/scope-list rendered; already-consented short-circuits via `navigateTo(redirect_url, { external: true })`.
- [x] Approve / Deny call `approveAuthorization` / `denyAuthorization`, then follow the returned `redirect_url` (`navigateTo(..., { external: true })`); surface API errors in the error state. → Done: with `{ skipBrowserRedirect: true }`, explicit redirect follow, pending-state guard against double clicks.
- [x] Unit/component tests (stub `supabase.auth.oauth`): renders client name + scopes; approve/deny invoke the correct method; missing-`authorization_id` error state. → Done: [useOAuthConsent.test.ts](file:///Users/jax/Dev/voc/tests/unit/useOAuthConsent.test.ts), 9 tests (118/118 total). Logic lives in the `useOAuthConsent` composable (project convention: thin pages, unit-tested composables).

#### 4.5 End-to-End Verification

- [ ] Manual happy path: authorization-code + PKCE flow (curl or scratch page) → sign in with a Voc account → approve consent → exchange code at `/auth/v1/oauth/token` → read and then write the user's `records` via PostgREST with the access token. → **Ready**: mock client at [scripts/oauth-mock-client.mjs](file:///Users/jax/Dev/voc/scripts/oauth-mock-client.mjs) (`node scripts/oauth-mock-client.mjs` → http://localhost:5000/); authorize endpoint smoke-tested via curl (302 → production consent, PKCE accepted). Pending: interactive run (runbook in [4.5 record](file:///Users/jax/Dev/voc/docs/4.5-oauth-e2e-verification.md)).
- [ ] RLS isolation: a token for user A cannot read or write user B's rows. → Runbook: run the mock flow as two different accounts and compare the read tables.
- [ ] Consent edge cases: missing `authorization_id`; already-consented `redirect_url` shortcut; deny returns an OAuth error to the client's redirect URI; unauthenticated bounce preserves `authorization_id` through login. → Verified headlessly: bounce on production (curl 302 with `redirect=/oauth/consent?authorization_id=x`), stale redirect URI rejected (400), missing-id + already-consented covered by unit tests; deny path pending interactive run.
- [ ] Finalize Site URL: switch Authentication → URL Configuration → Site URL from `http://localhost:3000` to `https://voc-9d5.pages.dev` (no trailing slash), add `http://localhost:3000/**` (+ other dev ports) to Redirect URLs, then smoke-test consent entry on the production origin. → Site URL is **already** `https://voc-9d5.pages.dev` (seen in the authorize 302) and production consent entry is smoke-tested (guard bounce verified); remaining: add `http://localhost:3000/**` to Redirect URLs.
- [x] `pnpm lint`, `pnpm test`, `pnpm build` all pass; implementation record per convention (`docs/4.x-oauth-provider.md`, created when work starts). → Done: lint 0/0, 118/118 tests, tsc clean, build success; record at [4.5-oauth-e2e-verification.md](file:///Users/jax/Dev/voc/docs/4.5-oauth-e2e-verification.md).

---

## 3. Milestones & Delivery Schedule

| Milestone                   | Target Deliverables                                            | Acceptance Criteria                                                            |
| --------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **M0: Project Bootstrap**   | Nuxt 4 + Nuxt UI + Supabase DB + CI                            | `pnpm dev`, `pnpm lint`, `pnpm test` all pass. Schema migrated.                |
| **M1: Auth & Capture**      | Email auth, RecordForm, Detail view                            | Users can sign up, confirm email, login, and add/edit words/phrases/sentences. |
| **M2: Library & Search**    | List view, multi-tag filter, keyword search                    | Instant filtering, responsive mobile UI, tags assigned and filtered cleanly.   |
| **M3: Review Engine (V2)**  | `srs.ts`, `/api/review/*`, Flashcard UI                        | Self-grading updates interval and schedules next review accurately.            |
| **M4: Stats & Habits (V2)** | Stats page, streak counter, session summary                    | Streak increments properly, review sessions complete with breakdown.           |
| **M5: V3 Release**          | JSON Export, pronunciation (TTS), PWA install, edge deployment | End-to-end user loop tested and deployed to Cloudflare Pages.                  |

---

## 4. Verification & Testing Plan

### Automated Testing

- **Unit tests (`vitest`)**:
  - `tests/server/srs.test.ts`: Verify all grade transitions (`forgot`, `hazy`, `know`, `easy`) and interval limits.
  - `tests/unit/schemas.test.ts`: Validate Zod schemas against valid/invalid payloads.
  - `tests/unit/useSpeech.test.ts`: Verify `speak`/`stop` wiring and English voice selection with a stubbed `speechSynthesis`.
- **Component tests (`@vue/test-utils` + `vitest`)**:
  - `tests/components/RecordCard.test.ts`: Correct badge rendering and data binding.
  - `tests/components/Flashcard.test.ts`: Flip state and grade emissions.
- **E2E tests (`playwright`)**:
  - `tests/e2e/auth.spec.ts`: Register -> verify state -> login -> logout.
  - `tests/e2e/records.spec.ts`: Create record -> list verification -> filter -> edit -> delete.
  - `tests/e2e/review.spec.ts`: Queue item due -> review card -> check stats update.

### Manual / Quality Verification

- **Cross-device testing**: Verify touch responsiveness on mobile viewports (375px–420px) and PC browser screens.
- **RLS verification**: Confirm through Supabase client tests that User A cannot read or write User B's records or custom tags.
- **Offline test**: Test PWA shell loading with network throttling / offline mode enabled in browser DevTools.
