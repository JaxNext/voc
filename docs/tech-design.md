# Tech Design: Vocabulary Capture & Review Web App

> Companion to [product-design.md](./product-design.md). All architecture decisions below implement the product design.

## 1. Stack Overview

| Layer                          | Choice                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Language                       | TypeScript                                                                                         |
| Framework (frontend + backend) | **Nuxt 4** (Vue 3 + Nitro server engine)                                                           |
| Toolchain                      | **VoidZero** ecosystem: Vite (Rolldown-powered) bundler, **oxlint** for linting, pnpm for packages |
| Database & Auth                | **Supabase Cloud** (hosted Postgres + **Supabase Auth**)                                           |
| UI                             | **Nuxt UI** (Vue components + Tailwind CSS, dark mode, responsive)                                 |
| PWA                            | `@vite-pwa/nuxt` (manifest, service worker, installable)                                           |
| Deployment                     | **Cloudflare Pages** (Nitro preset `cloudflare_pages`)                                             |
| Package manager                | pnpm (workspace-ready)                                                                             |

### Why this shape

- **Single Nuxt app = frontend + backend + PWA** in one codebase, deployed to one target (Cloudflare Pages). No separate API server to run.
- **Supabase handles auth + DB**: email verification and password reset are built-in (both required in MVP), and Postgres Row Level Security (RLS) protects every user's data.
- **VoidZero toolchain** keeps dev/build fast: Vite with Rust-powered Rolldown bundling and oxlint for near-instant linting.
- **PWA** makes the mobile-first app installable and usable offline (cached shell).

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Cloudflare Pages                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Nuxt 4 app (Nitro)                        │  │
│  │                                                        │  │
│  │  Vue pages (SSR/hydration)                             │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐  │  │
│  │  │ Record CRUD │ │ Auth pages │ │ Review (flashcard) │  │  │
│  │  └────────────┘ └────────────┘ └────────────────────┘  │  │
│  │        │                │               │              │  │
│  │  ┌─────▼───────────────▼───────────────▼─────────┐     │  │
│  │  │        @nuxtjs/supabase (client)              │     │  │
│  │  │  + JWT in HttpOnly cookie (server session)    │     │  │
│  │  └──────────────────────┬───────────────────────┘     │  │
│  │                         │                             │  │
│  │  ┌──────────────────────▼───────────────────────┐     │  │
│  │  │  Nitro server routes (only business logic):  │     │  │
│  │  │  /api/review/grade  /api/review/session      │     │  │
│  │  │  /api/stats                                 │     │  │
│  │  └──────────────────────┬───────────────────────┘     │  │
│  └─────────────────────────┼─────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTPS (PostgREST / Auth)
                 ┌───────────▼───────────┐
                 │     Supabase Cloud     │
                 │  ┌─────────┐ ┌───────┐ │
                 │  │ Postgres│ │ Auth  │ │
                 │  │  + RLS  │ │(email │ │
                 │  └─────────┘ │ +pwd) │ │
                 │              └───────┘ │
                 └─────────────────────────┘
```

**Key principle — thin server layer:** standard CRUD calls go **directly from the browser to Supabase** (PostgREST) using the user's JWT; RLS guarantees users can only touch their own rows. Nitro server routes exist **only** where business logic must not run on the client (SRS scheduling, stats aggregation).

---

## 3. Project Structure

```
voc/
├── app/
│   ├── app.vue                     # root layout (theme, toasts, nav shell)
│   ├── pages/
│   │   ├── index.vue               # Record list (Home)
│   │   ├── login.vue
│   │   ├── register.vue
│   │   ├── reset-password.vue
│   │   ├── verify-email.vue
│   │   ├── records/
│   │   │   ├── new.vue             # Add record form
│   │   │   └── [id].vue            # Detail + edit form
│   │   ├── review/
│   │   │   ├── index.vue           # Session start / queue
│   │   │   └── session.vue         # Flashcard flow + summary
│   │   ├── stats.vue
│   │   ├── tags.vue
│   │   └── settings.vue            # Me/Settings (export, password, logout)
│   ├── components/
│   │   ├── RecordCard.vue
│   │   ├── RecordForm.vue          # shared by new/edit
│   │   ├── Flashcard.vue
│   │   ├── TagPicker.vue
│   │   └── AppBottomNav.vue
│   ├── composables/
│   │   ├── useRecords.ts
│   │   ├── useTags.ts
│   │   └── useReview.ts
│   ├── middleware/
│   │   └── auth.global.ts          # redirect to /login when no session
│   ├── server/
│   │   ├── api/
│   │   │   ├── review/
│   │   │   │   ├── session.get.ts  # build today's session (N due items)
│   │   │   │   └── grade.post.ts   # apply self-grade -> SRS update
│   │   │   └── stats.get.ts        # streak, counts, weekly activity
│   │   ├── utils/
│   │   │   └── srs.ts              # interval math (pure function)
│   │   └── utils/supabase.ts       # service-role client (admin-only ops)
│   └── types/                      # shared TS types / Zod schemas
├── public/
│   ├── icons/                      # PWA icons (192/512/maskable)
│   └── favicon.ico
├── docs/
├── nuxt.config.ts                  # modules, PWA, nitro preset, runtime config
├── package.json
└── tsconfig.json
```

---

## 4. Toolchain (VoidZero)

| Tool                            | Role                 | Notes                                                                              |
| ------------------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| pnpm                            | Package manager      | Fast, strict, workspace-ready                                                      |
| **Vite** (Nuxt default builder) | Bundler / dev server | Nuxt 4 ships Vite; can opt into **Rolldown-Vite** (Rust bundler) for faster builds |
| **oxlint**                      | Linter               | oxc-based, ~50× faster than ESLint; runs in CI and `pre-commit`                    |
| TypeScript                      | Types                | Strict mode; Zod for runtime validation at API boundaries                          |
| Prettier                        | Formatter            | Stable formatting (oxc formatter can replace later when GA)                        |

> Note: oxlint's Vue SFC support is still maturing — if template linting is needed later, add `eslint-plugin-vue` alongside. For MVP, oxlint on `*.ts` + Prettier is sufficient.

---

## 5. Data Model (Supabase Postgres)

```sql
-- enum types
create type record_type as enum ('word', 'phrase', 'sentence');
create type learning_status as enum ('new', 'learning', 'mastered');
create type grade as enum ('forgot', 'hazy', 'know', 'easy');

-- 1 record = one sentence/phrase/word
create table records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        record_type not null,
  content     text not null,
  meaning     text not null,
  source      text,                       -- optional
  notes       text,                       -- optional
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- tags: predefined (user_id null = shared) + custom (user-owned)
create table tags (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade, -- null = predefined
  name          text not null,
  is_predefined boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, name)
);

create table record_tags (
  record_id uuid not null references records(id) on delete cascade,
  tag_id    uuid not null references tags(id) on delete cascade,
  primary key (record_id, tag_id)
);

-- SRS state, one row per record
create table review_states (
  record_id        uuid primary key references records(id) on delete cascade,
  status           learning_status not null default 'new',
  interval_days    int not null default 0,   -- current interval
  consecutive_pass int not null default 0,   -- consecutive know/easy
  last_reviewed_at timestamptz,
  next_review_at   timestamptz not null default now()
);

-- history log (drives stats + streak)
create table review_events (
  id          uuid primary key default gen_random_uuid(),
  record_id   uuid not null references records(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  grade       grade not null,
  reviewed_at timestamptz not null default now()
);

-- indexes for the two hot queries
create index idx_records_user_created on records (user_id, created_at desc);
create index idx_review_due on review_states (next_review_at) where status <> 'mastered';
create index idx_events_user_date on review_events (user_id, reviewed_at);
```

### Row Level Security (all tables)

```sql
alter table records      enable row level security;
alter table tags         enable row level security;
alter table record_tags  enable row level security;
alter table review_states enable row level security;
alter table review_events enable row level security;

-- policy for user-owned rows (records, custom tags, record_tags, states, events)
create policy "own rows only" on records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- predefined tags readable by everyone
create policy "predefined tags readable" on tags
  for select using (is_predefined);

-- custom tags owned only
create policy "own custom tags" on tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- record_tags joined through owned records
create policy "own record tags" on record_tags
  for all using (
    exists (select 1 from records r where r.id = record_tags.record_id and r.user_id = auth.uid())
  );
```

---

## 6. Auth (Supabase Auth + `@nuxtjs/supabase`)

- **Register / Login**: Supabase email + password. Session handled server-side via HttpOnly cookie (module default), no tokens in localStorage.
- **Email verification**: Supabase Auth sends confirmation email; `verify-email` page handles the redirect callback (`confirm` event).
- **Password reset**: Supabase `resetPasswordForEmail` → reset page updates password with the recovery token.
- **Route protection**: `auth.global.ts` middleware checks `useSupabaseUser()`; unauthenticated users are redirected to `/login`.
- **Env config**: `SESSION_PASSWORD` encrypts the auth cookie.

Email sending uses Supabase's built-in SMTP; a custom sender (Resend/SendGrid) can be configured later for deliverability.

---

## 7. Business Logic: SRS & Stats (Nitro)

### SRS interval math — `server/utils/srs.ts` (pure, unit-testable)

```ts
type Grade = 'forgot' | 'hazy' | 'know' | 'easy'

const INTERVALS = [0, 1, 3, 7, 14, 30] // multiplier ladder

function nextInterval(current: number, grade: Grade): number {
  switch (grade) {
    case 'forgot':
      return 1 // reset
    case 'hazy':
      return Math.max(1, Math.round(current / 2))
    case 'know':
      return INTERVALS[Math.min(INTERVALS.length - 1, INTERVALS.indexOf(current) + 1)]
    case 'easy':
      return Math.min(30, Math.round(current * 3))
  }
}
```

- `forgot` → status stays `learning`, interval resets to 1 day.
- `know`/`easy` → `consecutive_pass++`; 3 consecutive passes → status `mastered` (interval capped).
- Grading calls `POST /api/review/grade` which updates `review_states` + inserts `review_events` in one transaction (server-side, service-role client).
- **Session build** (`GET /api/review/session`): select due items (`next_review_at <= now`, not `mastered`), shuffle, take N (default 10).

### Stats — `GET /api/stats`

- Total / learning / mastered counts (aggregate over `review_states`).
- Streak: distinct `date(reviewed_at)` runs ending today/yesterday.
- Weekly activity: counts of `review_events` grouped by day.

---

## 8. PWA (`@vite-pwa/nuxt`)

- **Manifest**: name, short name, theme color, icons (192/512/maskable) in `public/icons/`.
- **Service worker**: workbox precache of app shell → offline loading; runtime cache for Supabase static responses (non-cacheable API calls fall back to UI toast "offline").
- **Installability**: `beforeinstallprompt` handler + "Install app" button in Settings; iOS `apple-touch-icon` for home-screen install.
- **Update flow**: `registerType: 'autoUpdate'` with a "new version available" toast.
- **Scope**: PWA caches the app shell only; user data always reads from Supabase when online (no local DB in MVP — adds complexity; revisit if offline capture becomes a requirement).

---

## 9. API Summary (Nitro routes only — the rest is direct Supabase)

| Method & Path                                      | Purpose                                        |
| -------------------------------------------------- | ---------------------------------------------- |
| `GET /api/review/session`                          | Build today's review session (due items, N=10) |
| `POST /api/review/grade`                           | Apply grade → update SRS state + log event     |
| `GET /api/stats`                                   | Streak, counts, weekly activity                |
| (CRUD: direct Supabase calls from client with RLS) |                                                |

---

## 10. Deployment (Cloudflare Pages)

- `nuxt.config.ts`: `nitro: { preset: 'cloudflare_pages' }` (auto-detected by CI template).
- **CI/CD**: GitHub repo → Cloudflare Pages project (Git integration). Build command `pnpm install && pnpm build` (output `.output/public`). Auto-preview on PRs, production on `main`.
- **Env vars** (secrets in Cloudflare Pages):
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (client, safe to expose)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only, never bundled to client)
  - `SESSION_PASSWORD` (cookie encryption, ≥32 chars)
- **Limits awareness**: Pages Functions are stateless (no filesystem/long tasks) — fits this app since all state lives in Supabase. Cold-start on first hit per edge; acceptable for MVP.

---

## 11. Security

- RLS on every table (see §5) — the primary defense; client never uses service-role key.
- Auth session in HttpOnly cookie; CSRF mitigated by Supabase JWT handling + `useFetch` with credentials.
- Server routes validate payloads with **Zod** and re-check `auth.uid()`; no trust in client-supplied `user_id`.
- Rate limiting on auth endpoints via Supabase's built-in protections; Supabase URL/keys held as Cloudflare secrets.
- Content: `text` rendered with `v-html`-free components (Nuxt UI escapes by default).

---

## 12. Testing & Quality

| Level     | Tool                    | Scope                               |
| --------- | ----------------------- | ----------------------------------- |
| Unit      | **Vitest**              | `srs.ts` interval math, Zod schemas |
| Component | Vue Test Utils + Vitest | `RecordForm`, `Flashcard`           |
| E2E       | **Playwright**          | login → add record → review flow    |
| Lint      | **oxlint** + Prettier   | pre-commit hook (lint-staged)       |

---

## 13. Phasing (maps to product design §4)

| Phase     | Tech work                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Setup** | Scaffold Nuxt 4 + Nuxt UI + Supabase module + PWA + Cloudflare Pages CI + oxlint                                                         |
| **MVP**   | Auth flows (register/login/verify/reset), records CRUD (direct Supabase + RLS), tags (predefined + custom), list with search/filter/sort |
| **V2**    | Review session (flashcards, self-grade, SRS via Nitro), session summary, stats dashboard (streak/counts)                                 |
| **V3**    | SRS refinement, JSON export, random pick, advanced stats                                                                                 |

---

## 14. Risks & Mitigations

| Risk                                      | Mitigation                                                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edge → Supabase latency                   | Supabase hosted in nearest region (Singapore/Japan for APAC users); keep record list queries indexed; consider Cloudflare Cache for read-only aggregates later |
| Pages Functions cold start                | Pre-warm via periodic request; most reads are direct client→Supabase so Nitro load is low                                                                      |
| Email deliverability (verification/reset) | Configure custom SMTP sender (Resend) when signups grow                                                                                                        |
| PWA offline vs online data                | MVP = app shell offline + live data online; offline capture queue is a documented follow-up                                                                    |
| Supabase free tier limits                 | Row counts/MAU fit MVP; monitor usage dashboard; upgrade plan when needed                                                                                      |

---

## 15. Local Development

```bash
# env (.env): SUPABASE_URL, SUPABASE_ANON_KEY, SESSION_PASSWORD (+ service role for server routes)
pnpm install
pnpm dev        # http://localhost:3000
pnpm lint       # oxlint
pnpm test       # vitest unit/component
pnpm build      # Nuxt build (cloudflare_pages preset)
```

Optionally run `supabase start` (Docker) for a local Postgres+Auth during development; the app is identical either way because it only talks to Supabase via URL + keys.
