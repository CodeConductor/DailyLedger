-- =============================================================================
-- RCC (Spun) Concrete Pipe Plant — Daily Production Register
-- COMPLETE Supabase / Postgres schema (single file — no migrations needed)
-- =============================================================================
-- Run this ENTIRE file ONCE in the Supabase SQL Editor (Dashboard > SQL Editor).
-- It creates every table, index, trigger, Row Level Security policy and seed the
-- app needs, INCLUDING the cement-yield reconciliation feature.
--
-- Safe to re-run EXCEPT the seed section at the bottom (see RE-RUN NOTES).
--
-- FREE-TIER NOTES
--   * All tables store only small scalar values (numbers, short text, a small
--     JSONB blob for optional raw materials). No files/blobs/attachments.
--   * Rough growth math (see README "Free-tier capacity"):
--       ~3 machines x ~15 sizes = ~45 production rows/day + ~6 fuel rows/day
--       => ~51 rows/day => ~18,600 rows/year at <1 KB/row => < 20 MB/year.
--     Many years fit inside the Supabase free 500 MB database.
--   * cement_standards + fuel_log_contractors grow very slowly (a few standard
--     edits ever; a handful of contractor tags per machine/day) — negligible.
--   * If you ever approach the limit, ARCHIVE old years to CSV then DELETE them
--     (see README) rather than upgrading to a paid plan.
--
-- FORWARD-COMPATIBILITY
--   Single tenant now, but every table carries org_id (defaulted to one fixed
--   org) so a second organisation can be added later WITHOUT a schema rewrite.
--   Fixed default org id: 00000000-0000-0000-0000-000000000001
-- =============================================================================

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- =============================================================================
-- ENUM: fuel_type  (cement / diesel)
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'fuel_type') then
    create type public.fuel_type as enum ('cement', 'diesel');
  end if;
end
$$;

-- =============================================================================
-- TABLE: machines  (production lines / spinning machines)
-- =============================================================================
create table if not exists public.machines (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default '00000000-0000-0000-0000-000000000001',
  name       text not null,                       -- e.g. "Machine 1", "Line A"
  active     boolean not null default true,       -- archived = false (soft)
  created_at timestamptz not null default now()
);

-- =============================================================================
-- TABLE: pipe_sizes  (register rows: 150/3 ... 1000/3, PILLAR, F.J.)
-- =============================================================================
create table if not exists public.pipe_sizes (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default '00000000-0000-0000-0000-000000000001',
  label      text not null,                       -- e.g. "150/3", "1000/3"
  category   text not null default 'S&S',         -- "S&S" | "PILLAR" | "F.J."
  sort_order int  not null default 0,             -- display order in grid
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- TABLE: contractors  (crews/persons who made a batch — NOT permanent staff)
--   Names change over time and float across machines & sizes.
--   NEVER hard-delete; deactivate instead so historical reports keep the name.
-- =============================================================================
create table if not exists public.contractors (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default '00000000-0000-0000-0000-000000000001',
  name       text not null,                       -- free text; supports Devanagari
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- TABLE: production_entries  (one cell of the daily grid)
--   machine_id, pipe_size_id, contractor_id are all INDEPENDENT.
--   A contractor may appear many times in one day across machine/size combos.
-- =============================================================================
create table if not exists public.production_entries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null default '00000000-0000-0000-0000-000000000001',
  date          date not null,
  machine_id    uuid not null references public.machines(id),
  pipe_size_id  uuid not null references public.pipe_sizes(id),
  contractor_id uuid not null references public.contractors(id),
  good_qty      integer not null default 0 check (good_qty   >= 0),
  reject_qty    integer not null default 0 check (reject_qty >= 0),
  -- Optional per-row raw materials: {"cutting_oil": 2, "20mm": 100, "jeera": 5,...}
  raw_materials jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_prod_date           on public.production_entries (date);
create index if not exists idx_prod_contractor_date on public.production_entries (contractor_id, date);
create index if not exists idx_prod_size_date       on public.production_entries (pipe_size_id, date);
create index if not exists idx_prod_machine_date    on public.production_entries (machine_id, date);

-- =============================================================================
-- TABLE: fuel_logs  (per machine per day — NOT per contractor)
--   Two fuel types: cement (सीमेंट) and diesel (डीजल).
--   closing defaults to opening - consumed in the UI (override allowed).
-- =============================================================================
create table if not exists public.fuel_logs (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default '00000000-0000-0000-0000-000000000001',
  date       date not null,
  machine_id uuid not null references public.machines(id),
  fuel_type  public.fuel_type not null,
  opening    numeric(12,2) not null default 0 check (opening  >= 0),
  consumed   numeric(12,2) not null default 0 check (consumed >= 0),
  closing    numeric(12,2) not null default 0 check (closing  >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one row per machine + day + fuel type (lets us upsert on edit):
  unique (org_id, date, machine_id, fuel_type)
);

create index if not exists idx_fuel_date         on public.fuel_logs (date);
create index if not exists idx_fuel_machine_date on public.fuel_logs (machine_id, date);

-- =============================================================================
-- TABLE: cement_standards  (plant's own bags-per-pipe standard, effective-dated)
--   Editing the standard INSERTS a new row with a later effective_date rather
--   than updating in place, so a report for a past day always uses the standard
--   that was effective on that day. bags_per_pipe defaults to 0 — the plant's
--   QC/mix-design staff enter their own figure. NOTHING is hardcoded here.
-- =============================================================================
create table if not exists public.cement_standards (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null default '00000000-0000-0000-0000-000000000001',
  pipe_size_id   uuid not null references public.pipe_sizes(id),
  bags_per_pipe  numeric(10,4) not null default 0 check (bags_per_pipe >= 0),
  effective_date date not null default current_date,
  created_at     timestamptz not null default now()
);

create index if not exists idx_cement_std_size_date
  on public.cement_standards (pipe_size_id, effective_date desc);

-- =============================================================================
-- TABLE: fuel_log_contractors  (many-to-many)
--   Which contractor(s) operated a machine when its cement was drawn that day.
--   Tags attach to the CEMENT fuel_log row for that machine/day (what the
--   reconciliation report reads). ON DELETE CASCADE keeps it tidy.
-- =============================================================================
create table if not exists public.fuel_log_contractors (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null default '00000000-0000-0000-0000-000000000001',
  fuel_log_id   uuid not null references public.fuel_logs(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id),
  created_at    timestamptz not null default now(),
  unique (fuel_log_id, contractor_id)
);

create index if not exists idx_flc_fuel       on public.fuel_log_contractors (fuel_log_id);
create index if not exists idx_flc_contractor on public.fuel_log_contractors (contractor_id);

-- =============================================================================
-- TABLE: app_settings  (single-row config, e.g. which raw-material fields show)
-- =============================================================================
create table if not exists public.app_settings (
  org_id            uuid primary key default '00000000-0000-0000-0000-000000000001',
  raw_material_fields jsonb not null default
    '[{"key":"cutting_oil","label_en":"Cutting Oil","label_hi":"कटिंग ऑयल","enabled":true},
      {"key":"20mm","label_en":"20mm","label_hi":"20mm","enabled":true},
      {"key":"10mm","label_en":"10mm","label_hi":"10mm","enabled":true},
      {"key":"jeera","label_en":"Jeera","label_hi":"जीरा","enabled":true},
      {"key":"dust","label_en":"Dust","label_hi":"डस्ट","enabled":true},
      {"key":"450_2","label_en":"450/2","label_hi":"450/2","enabled":false},
      {"key":"1000_3","label_en":"1000/3","label_hi":"1000/3","enabled":false}]'::jsonb,
  updated_at        timestamptz not null default now()
);

insert into public.app_settings (org_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (org_id) do nothing;

-- =============================================================================
-- updated_at triggers (keep updated_at fresh on edits)
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_prod_updated on public.production_entries;
create trigger trg_prod_updated before update on public.production_entries
  for each row execute function public.set_updated_at();

drop trigger if exists trg_fuel_updated on public.fuel_logs;
create trigger trg_fuel_updated before update on public.fuel_logs
  for each row execute function public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
--   v1 = single supervisor login. Policy: any AUTHENTICATED user may read/write.
--   Structured so a real org_id -> user mapping can replace the policy later
--   without touching table shapes or the app queries.
-- =============================================================================
alter table public.machines             enable row level security;
alter table public.pipe_sizes           enable row level security;
alter table public.contractors          enable row level security;
alter table public.production_entries   enable row level security;
alter table public.fuel_logs            enable row level security;
alter table public.cement_standards     enable row level security;
alter table public.fuel_log_contractors enable row level security;
alter table public.app_settings         enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'machines','pipe_sizes','contractors',
    'production_entries','fuel_logs',
    'cement_standards','fuel_log_contractors',
    'app_settings'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_auth_all', t);
    execute format($f$
      create policy %I on public.%I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, t || '_auth_all', t);
  end loop;
end
$$;

-- =============================================================================
-- SEED DATA (safe to keep — edit later in the Settings page)
--   ⚠️ Only run this section ONCE. See RE-RUN NOTES.
-- =============================================================================
-- Machines
insert into public.machines (name) values ('Machine 1'), ('Machine 2'), ('Machine 3')
on conflict do nothing;

-- Pipe sizes (typical spun-pipe register rows). category: S&S / PILLAR / F.J.
insert into public.pipe_sizes (label, category, sort_order) values
  ('150/3',  'S&S', 10),
  ('200/3',  'S&S', 20),
  ('250/3',  'S&S', 30),
  ('300/3',  'S&S', 40),
  ('350/3',  'S&S', 50),
  ('400/3',  'S&S', 60),
  ('450/3',  'S&S', 70),
  ('500/3',  'S&S', 80),
  ('600/3',  'S&S', 90),
  ('700/3',  'S&S', 100),
  ('800/3',  'S&S', 110),
  ('900/3',  'S&S', 120),
  ('1000/3', 'S&S', 130),
  ('PILLAR', 'PILLAR', 140),
  ('F.J.',   'F.J.', 150)
on conflict do nothing;

-- A couple of starter contractors (names are illustrative; edit in Settings)
insert into public.contractors (name) values ('राम कुमार'), ('श्याम')
on conflict do nothing;

-- Baseline 0-bag cement standard (effective 2000-01-01, so it covers ALL past
-- dates) for every pipe_size that has none yet. Enter real values in Settings.
insert into public.cement_standards (pipe_size_id, bags_per_pipe, effective_date)
select ps.id, 0, date '2000-01-01'
from public.pipe_sizes ps
where not exists (
  select 1 from public.cement_standards cs where cs.pipe_size_id = ps.id
);

-- =============================================================================
-- RE-RUN NOTES
--   * Everything ABOVE the SEED DATA section is safe to re-run: tables/indexes
--     use "if not exists", the enum is guarded by a DO block, policies are
--     dropped before create, and app_settings uses ON CONFLICT.
--   * The cement_standards baseline insert is guarded by "where not exists", so
--     it is also safe to re-run.
--   * The machines / pipe_sizes / contractors seeds have NO unique constraint on
--     name, so re-running WILL create duplicates. Run the SEED section only once,
--     or clear those tables first.
-- =============================================================================
