-- Voc initial schema: enums, tables, indexes, RLS policies, predefined tag seeds.
-- Reference: docs/tech-design.md §5, docs/development-plan.md §0.2

-- ============================ Enums ============================

create type public.record_type as enum ('word', 'phrase', 'sentence');

create type public.learning_status as enum ('new', 'learning', 'mastered');

create type public.grade as enum ('forgot', 'hazy', 'know', 'easy');

-- ============================ Tables ============================

-- One row = one captured word / phrase / sentence.
create table public.records (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       public.record_type not null,
  content    text not null,
  meaning    text not null,
  source     text,               -- optional
  notes      text,               -- optional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tags: is_predefined = true → shared (user_id null); false → user-owned.
create table public.tags (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete cascade, -- null for predefined
  name          text not null,
  is_predefined boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Custom tag names must be unique per user; predefined tag names globally unique.
-- (A plain unique (user_id, name) would not cover predefined rows because
-- NULL user_id values never collide, hence partial unique indexes.)
create unique index tags_custom_name_unique
  on public.tags (user_id, name)
  where user_id is not null;

create unique index tags_predefined_name_unique
  on public.tags (name)
  where is_predefined;

-- Join table between records and tags.
create table public.record_tags (
  record_id uuid not null references public.records (id) on delete cascade,
  tag_id    uuid not null references public.tags (id) on delete cascade,
  primary key (record_id, tag_id)
);

-- SRS state: exactly one row per record.
create table public.review_states (
  record_id        uuid primary key references public.records (id) on delete cascade,
  status           public.learning_status not null default 'new',
  interval_days    int not null default 0,       -- current interval in days
  consecutive_pass int not null default 0,       -- consecutive know/easy passes
  last_reviewed_at timestamptz,
  next_review_at   timestamptz not null default now() -- due immediately when created
);

-- Append-only grade log; drives stats and streaks.
create table public.review_events (
  id          uuid primary key default gen_random_uuid(),
  record_id   uuid not null references public.records (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  grade       public.grade not null,
  reviewed_at timestamptz not null default now()
);

-- ============================ Indexes ============================

-- Hot queries: newest-first record list per user.
create index idx_records_user_created
  on public.records (user_id, created_at desc);

-- Hot query: due review items (non-mastered, next_review_at <= now()).
create index idx_review_due
  on public.review_states (next_review_at)
  where status <> 'mastered';

-- Hot query: stats & streak (events per user per day).
create index idx_events_user_date
  on public.review_events (user_id, reviewed_at);

-- Keep records.updated_at in sync on any update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger records_set_updated_at
  before update on public.records
  for each row execute function public.set_updated_at();

-- ============================ Row Level Security ============================

alter table public.records       enable row level security;
alter table public.tags          enable row level security;
alter table public.record_tags   enable row level security;
alter table public.review_states enable row level security;
alter table public.review_events enable row level security;

-- records: owner only.
create policy "records owner all" on public.records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- tags: predefined tags readable by everyone; custom tags owned by creator.
create policy "tags predefined readable" on public.tags
  for select
  using (is_predefined);

create policy "tags owner all" on public.tags
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- record_tags: only for records owned by the caller.
create policy "record_tags owner all" on public.record_tags
  for all
  using (
    exists (
      select 1 from public.records r
      where r.id = record_tags.record_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.records r
      where r.id = record_tags.record_id and r.user_id = auth.uid()
    )
  );

-- review_states: owned through the parent record (no user_id column here).
create policy "review_states owner all" on public.review_states
  for all
  using (
    exists (
      select 1 from public.records r
      where r.id = review_states.record_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.records r
      where r.id = review_states.record_id and r.user_id = auth.uid()
    )
  );

-- review_events: owned rows only.
create policy "review_events owner all" on public.review_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================ Privileges ============================

-- RLS policies only take effect for roles that hold table privileges.
-- The client talks to PostgREST as `authenticated` (or `anon` pre-login);
-- the server (Nitro) uses `service_role`, which bypasses RLS entirely.
grant select, insert, update, delete
  on public.records,
     public.tags,
     public.record_tags,
     public.review_states,
     public.review_events
  to authenticated;

grant select on public.tags to anon; -- predefined tags are public by design

-- ============================ Seed: predefined tags ============================

insert into public.tags (name, is_predefined)
values
  ('work', true),
  ('daily', true),
  ('idiom', true),
  ('travel', true)
on conflict (name) where is_predefined do nothing;
