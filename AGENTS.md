# AGENTS.md

Guidance for AI agents and contributors working in this repository.

## Project Overview

**Voc** — a vocabulary capture & review web app for English learners. Users save sentences, phrases, and words they encounter, then review them with structured (spaced-repetition) memorization.

- Product design: [docs/product-design.md](docs/product-design.md)
- Tech design: [docs/tech-design.md](docs/tech-design.md)

**Core value loop:** Capture → Organize → Review → Progress.

## Tech Stack

| Area      | Choice                                                    |
| --------- | --------------------------------------------------------- |
| Framework | Nuxt 4 (Vue 3 + Nitro server engine) — fullstack, one app |
| Language  | TypeScript (strict)                                       |
| Toolchain | pnpm · Vite (Rolldown option) · oxlint · Prettier         |
| DB + Auth | Supabase Cloud (Postgres + RLS + Supabase Auth)           |
| UI        | Nuxt UI (Tailwind-based components)                       |
| PWA       | `@vite-pwa/nuxt`                                          |
| Deploy    | Cloudflare Pages (nitro preset `cloudflare_pages`)        |
| Tests     | Vitest (unit/component) · Playwright (e2e)                |

## Commands

```bash
pnpm install        # install dependencies
pnpm dev            # dev server at http://localhost:3000
pnpm lint           # oxlint
pnpm format         # prettier
pnpm test           # vitest unit/component
pnpm build          # Nuxt build (cloudflare_pages preset)
pnpm e2e            # playwright
```

## Project Structure

```
app/
├── pages/          # routes: index (list), login, register, records/[id], review, stats, tags, settings
├── components/     # RecordCard, RecordForm, Flashcard, TagPicker, AppBottomNav…
├── composables/    # useRecords, useTags, useReview
├── middleware/     # auth.global.ts (redirect to /login when unauthenticated)
├── server/
│   ├── api/        # Nitro routes: /api/review/session, /api/review/grade, /api/stats
│   └── utils/      # srs.ts (interval math, pure), supabase.ts (service-role client)
└── types/          # shared TS types + Zod schemas
docs/               # product-design.md, tech-design.md
public/             # PWA icons, favicon
```

## Architecture Rules (critical)

1. **Thin Nitro layer.** Standard CRUD goes directly from the browser to Supabase (PostgREST) using the user's JWT — do NOT add Nitro routes for plain CRUD. Nitro routes exist only for business logic that must not run client-side: SRS grading, session building, stats.
2. **RLS is the primary defense.** Every table must have Row Level Security enabled. The client never uses the service-role key.
3. **Never expose `SUPABASE_SERVICE_ROLE_KEY`** to the client. It is server-only, held as a Cloudflare secret. Only `SUPABASE_URL` and `SUPABASE_ANON_KEY` are safe to send to the browser.
4. **Validate at API boundaries** with Zod. Never trust client-supplied `user_id` — always derive identity from the auth session (`auth.uid()` / `useSupabaseUser()`).
5. **SRS math lives in `server/utils/srs.ts`** as a pure function (unit-testable). Grading updates `review_states` and inserts `review_events` in one transaction.

## Data Model Conventions

- `records`: one row per sentence/phrase/word; `type` ∈ `word|phrase|sentence`.
- `tags`: `is_predefined` tags are shared (user_id null); custom tags are user-owned.
- `review_states`: one row per record; fields `status`, `interval_days`, `consecutive_pass`, `next_review_at`.
- `review_events`: append-only log for stats and streak.
- Hot queries: `records (user_id, created_at desc)`, due reviews on `review_states (next_review_at) where status <> 'mastered'`.

## Auth

- Supabase Auth (email + password) with email verification and password reset — both are MVP requirements.
- Session via HttpOnly cookie (`@nuxtjs/supabase`); no tokens in localStorage.
- New pages that require login must be covered by `auth.global.ts`; guard server routes by re-checking the session.

## Code Style & Conventions

- TypeScript strict; prefer explicit types at module boundaries.
- Vue: `<script setup>` SFCs, composition API. Use Nuxt UI components for inputs/buttons/dialogs; mobile-first layouts (compact controls, bottom nav for app pages).
- Naming: `use*` for composables, PascalCase SFCs, kebab-case files under `components/`.
- Comments in English; avoid unnecessary comments.
- No `v-html` with user content (Nuxt UI escapes by default — keep it that way).

## Git Workflow

- pnpm only; commit `pnpm-lock.yaml`.
- Run `pnpm lint` and `pnpm test` before committing.
- Never commit secrets (`.env`, service-role keys). Env vars are Cloudflare secrets.
- Conventional commits; PRs auto-deploy previews via Cloudflare Pages.

## Phasing

- **MVP**: auth flows, records CRUD, tags (predefined + custom), list with search/filter/sort.
- **V2**: review session (flashcards, self-grade, SRS), session summary, stats dashboard.
- **V3**: SRS refinement, JSON export, random pick, advanced stats.

See [docs/tech-design.md §13](docs/tech-design.md) for the mapping.
