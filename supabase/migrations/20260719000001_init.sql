-- Micro Budget — initial schema (Supabase mirror of the local SQLite ledger).
-- Source of truth on device is SQLite; this is the sync/backup + RLS target.
-- Single writer per user + ghost companions => every row is owned by one auth user.
-- Money is stored as BIGINT in ISO-4217 minor units (VND=0 decimals, PHP=2, KWD=3).
-- Sync columns: updated_at (LWW) + deleted_at (soft delete) on every syncable table.

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------- shared: updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- people (ghost mode: local labels; is_me flags the owner) ----------
create table public.people (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null,
  avatar_emoji  text,
  is_me         boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- ---------- trips ----------
create table public.trips (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null,
  start_date    date,
  end_date      date,
  home_currency text not null,
  location_tracking_enabled boolean not null default false,
  status        text not null default 'active' check (status in ('planned','active','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create table public.trip_members (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  person_id  uuid not null references public.people(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (trip_id, person_id)
);

-- ---------- accounts (bank | cash | ewallet | card | foreign-cash pool) ----------
create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  currency        text not null,
  type            text not null check (type in ('bank','cash','ewallet','card','pool')),
  cost_basis_rate numeric,                                  -- null for home currency
  trip_id         uuid references public.trips(id) on delete set null,  -- pools die with their trip
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- ---------- categories & budgets (daily mode) ----------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  icon       text,
  parent_id  uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  amount      bigint not null,                              -- minor units
  currency    text not null,
  cycle       text not null default 'monthly' check (cycle in ('weekly','monthly')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ---------- receipts ----------
create table public.receipts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  image_local_path  text,
  image_remote_path text,
  ocr_raw_text      text,
  parsed_json       jsonb,                                  -- merchant, total, currency, date, line_items
  parse_method      text check (parse_method in ('mlkit','ai','manual')),
  status            text not null default 'unprocessed' check (status in ('unprocessed','parsed','matched')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- ---------- location: raw points (pruned) + extracted stays ----------
create table public.stays (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id       uuid references public.trips(id) on delete cascade,
  lat           double precision,
  lng           double precision,
  arrived_at    timestamptz,
  departed_at   timestamptz,
  poi_name      text,
  poi_category  text,
  poi_place_id  text,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','no_spend','matched')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create table public.location_points (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id    uuid references public.trips(id) on delete cascade,
  lat        double precision,
  lng        double precision,
  accuracy   double precision,
  timestamp  timestamptz not null default now()
);

-- ---------- expenses (the one ledger; trips are a view over trip_id) ----------
create table public.expenses (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id            uuid references public.accounts(id) on delete set null,   -- null in daily, set in travel
  amount                bigint not null,                    -- minor units
  currency              text not null,
  category_id           uuid references public.categories(id) on delete set null,
  trip_id               uuid references public.trips(id) on delete set null,
  paid_by               uuid references public.people(id) on delete set null,     -- defaults to is_me in app
  timestamp             timestamptz not null default now(),
  note                  text,
  settlement_status     text not null default 'confirmed' check (settlement_status in ('pending','confirmed')),
  estimated_home_amount bigint,
  actual_home_amount    bigint,
  receipt_id            uuid references public.receipts(id) on delete set null,
  stay_id               uuid references public.stays(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

-- who fronted (paid_by on expense) vs who owes (splits). Resolved AMOUNTS, never percentages.
create table public.splits (
  expense_id   uuid not null references public.expenses(id) on delete cascade,
  person_id    uuid not null references public.people(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  share_amount bigint not null,
  primary key (expense_id, person_id)
);

-- ---------- transfers (the ONE entity for moves / exchange / ATM / card FX) ----------
create table public.transfers (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_account_id   uuid references public.accounts(id) on delete set null,
  to_account_id     uuid references public.accounts(id) on delete set null,
  from_amount       bigint not null,
  from_currency     text not null,
  to_amount         bigint not null,
  to_currency       text not null,
  timestamp         timestamptz not null default now(),
  source            text check (source in ('atm','changer','card','internal')),
  settlement_status text not null default 'confirmed' check (settlement_status in ('pending','confirmed')),
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create table public.transfer_fees (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transfer_id uuid not null references public.transfers(id) on delete cascade,
  label       text,
  amount      bigint not null,
  currency    text not null,
  is_derived  boolean not null default false
);

-- ---------- indexes for the common access paths ----------
create index on public.expenses (user_id, timestamp desc);
create index on public.expenses (trip_id);
create index on public.expenses (category_id);
create index on public.expenses (receipt_id);
create index on public.expenses (stay_id);
create index on public.splits (person_id);
create index on public.accounts (user_id, trip_id);
create index on public.transfers (user_id, timestamp desc);
create index on public.stays (trip_id, arrived_at);
create index on public.location_points (trip_id, timestamp);
create index on public.trip_members (person_id);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array[
    'people','trips','accounts','categories','budgets','receipts',
    'stays','expenses','transfers'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ---------- Row-Level Security: each user sees only their own rows ----------
do $$
declare t text;
begin
  foreach t in array array[
    'people','trips','trip_members','accounts','categories','budgets',
    'receipts','stays','location_points','expenses','splits','transfers','transfer_fees'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "owner_all" on public.%I
         for all to authenticated
         using (user_id = auth.uid())
         with check (user_id = auth.uid());', t);
  end loop;
end $$;
