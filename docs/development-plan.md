# Development Plan: Vocabulary Capture & Review Web App (Voc)

This document outlines the actionable, step-by-step engineering roadmap to implement the **Voc** web application based on [product-design.md](./product-design.md) and [tech-design.md](./tech-design.md).

---

## 1. Overview & Phasing Strategy

Following product & architecture specifications, development is structured into 4 sequential phases:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Phase 0: Setup  │ ──> │   Phase 1: MVP  │ ──> │   Phase 2: V2   │ ──> │   Phase 3: V3   │
│ Infra, DB & CI  │     │ CRUD & Auth     │     │ SRS & Stats     │     │ Polish & Export │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **Phase 0: Foundation & Toolchain Setup** — Tooling, linting, tests, Supabase DB schema/migrations, basic project structure.
- **Phase 1: MVP (Capture, Organize, Auth)** — Authentication with email verification & password reset, Direct Supabase PostgREST CRUD with RLS, Tagging system, Record list with search, filter, and sorting.
- **Phase 2: V2 (Review & Habits)** — Nitro review session builder & grading API, pure SRS algorithm logic (`srs.ts`), Flashcard flow, session summary, and basic stats dashboard (streaks & counts).
- **Phase 3: V3 (Refinement & Portability)** — Refined SRS algorithm, JSON export, Word-of-the-day / random pick, advanced statistics, PWA install prompt & offline shell polish.

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

- [ ] Nitro API route `server/api/stats.get.ts`:
  - Aggregations: Total records count, learning count, mastered count.
  - Streak calculation: consecutive distinct active review dates ending today/yesterday.
  - Weekly review activity (counts per day for the last 7 days).
- [ ] Page `app/pages/stats.vue`:
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

#### 3.3 PWA Offline Resilience & Deployment Optimization

- [ ] Service worker offline caching polish:
  - App shell precaching.
  - UI banner displaying offline status when disconnected.
- [ ] Settings page install button:
  - Capture `beforeinstallprompt` event and trigger native install prompt.
- [ ] Cloudflare Pages build validation:
  - Verify edge bundle size and cold start performance.

---

## 3. Milestones & Delivery Schedule

| Milestone                   | Target Deliverables                         | Acceptance Criteria                                                            |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| **M0: Project Bootstrap**   | Nuxt 4 + Nuxt UI + Supabase DB + CI         | `pnpm dev`, `pnpm lint`, `pnpm test` all pass. Schema migrated.                |
| **M1: Auth & Capture**      | Email auth, RecordForm, Detail view         | Users can sign up, confirm email, login, and add/edit words/phrases/sentences. |
| **M2: Library & Search**    | List view, multi-tag filter, keyword search | Instant filtering, responsive mobile UI, tags assigned and filtered cleanly.   |
| **M3: Review Engine (V2)**  | `srs.ts`, `/api/review/*`, Flashcard UI     | Self-grading updates interval and schedules next review accurately.            |
| **M4: Stats & Habits (V2)** | Stats page, streak counter, session summary | Streak increments properly, review sessions complete with breakdown.           |
| **M5: V3 Release**          | JSON Export, PWA install, edge deployment   | End-to-end user loop tested and deployed to Cloudflare Pages.                  |

---

## 4. Verification & Testing Plan

### Automated Testing

- **Unit tests (`vitest`)**:
  - `tests/server/srs.test.ts`: Verify all grade transitions (`forgot`, `hazy`, `know`, `easy`) and interval limits.
  - `tests/unit/schemas.test.ts`: Validate Zod schemas against valid/invalid payloads.
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
