// Local SQLite schema — the SOURCE OF TRUTH on device. Mirrors the Supabase
// schema (docs / supabase/migrations) minus auth/RLS, since the device is a
// single user. Money is INTEGER minor units; ids are client-generated TEXT
// uuids; timestamps are ISO TEXT. Everything works with no account; the `outbox`
// captures changes to push to Supabase once the user signs in.

export type Migration = { name: string; sql: string };

const INIT = /* sql */ `
create table if not exists people (
  id text primary key,
  name text not null,
  avatar_emoji text,
  is_me integer not null default 0,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create table if not exists trips (
  id text primary key,
  name text not null,
  start_date text,
  end_date text,
  home_currency text not null,
  location_tracking_enabled integer not null default 0,
  status text not null default 'active',
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create table if not exists trip_members (
  trip_id text not null references trips(id) on delete cascade,
  person_id text not null references people(id) on delete cascade,
  primary key (trip_id, person_id)
);

create table if not exists accounts (
  id text primary key,
  name text not null,
  currency text not null,
  type text not null,                 -- bank|cash|ewallet|card|pool
  cost_basis_rate real,
  trip_id text references trips(id) on delete set null,
  archived_at text,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create table if not exists categories (
  id text primary key,
  name text not null,
  icon text,
  parent_id text references categories(id) on delete set null,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create table if not exists budgets (
  id text primary key,
  category_id text references categories(id) on delete cascade,
  amount integer not null,            -- minor units
  currency text not null,
  cycle text not null default 'monthly',
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create table if not exists receipts (
  id text primary key,
  image_local_path text,
  image_remote_path text,
  ocr_raw_text text,
  parsed_json text,
  parse_method text,                  -- mlkit|ai|manual
  status text not null default 'unprocessed',
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create table if not exists stays (
  id text primary key,
  trip_id text references trips(id) on delete cascade,
  lat real, lng real,
  arrived_at text, departed_at text,
  poi_name text, poi_category text, poi_place_id text,
  review_status text not null default 'unreviewed',
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create table if not exists location_points (
  id text primary key,
  trip_id text references trips(id) on delete cascade,
  lat real, lng real, accuracy real,
  timestamp text not null
);

-- The one ledger. Daily mode: account_id + trip_id are null. Travel: both set.
create table if not exists expenses (
  id text primary key,
  account_id text references accounts(id) on delete set null,
  amount integer not null,            -- minor units
  currency text not null,
  category_id text references categories(id) on delete set null,
  trip_id text references trips(id) on delete set null,
  paid_by text references people(id) on delete set null,
  timestamp text not null,
  note text,
  settlement_status text not null default 'confirmed',
  estimated_home_amount integer,
  actual_home_amount integer,
  receipt_id text references receipts(id) on delete set null,
  stay_id text references stays(id) on delete set null,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create table if not exists splits (
  expense_id text not null references expenses(id) on delete cascade,
  person_id text not null references people(id) on delete cascade,
  share_amount integer not null,      -- resolved amounts, never percentages
  primary key (expense_id, person_id)
);

create table if not exists transfers (
  id text primary key,
  from_account_id text references accounts(id) on delete set null,
  to_account_id text references accounts(id) on delete set null,
  from_amount integer not null, from_currency text not null,
  to_amount integer not null, to_currency text not null,
  timestamp text not null,
  source text, settlement_status text not null default 'confirmed',
  note text,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create table if not exists transfer_fees (
  id text primary key,
  transfer_id text not null references transfers(id) on delete cascade,
  label text, amount integer not null, currency text not null,
  is_derived integer not null default 0
);

create index if not exists idx_expenses_ts on expenses(timestamp desc);
create index if not exists idx_expenses_trip on expenses(trip_id);
create index if not exists idx_expenses_cat on expenses(category_id);
create index if not exists idx_splits_person on splits(person_id);

-- Local-first plumbing --------------------------------------------------------
-- Outbox: every mutation enqueues a Supabase-shaped payload; flushed on sign-in.
create table if not exists outbox (
  id integer primary key autoincrement,
  entity text not null,               -- table name
  entity_id text not null,
  op text not null,                   -- 'upsert' | 'delete'
  payload text not null,              -- JSON with Supabase-typed fields
  created_at text not null
);

create table if not exists sync_meta (
  key text primary key,
  value text
);
`;

export const MIGRATIONS: Migration[] = [{ name: "001_init", sql: INIT }];
