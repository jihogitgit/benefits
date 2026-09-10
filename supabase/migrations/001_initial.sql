create extension if not exists "uuid-ossp";

create table benefits (
  id uuid primary key default uuid_generate_v4(),
  source text not null,
  source_id text not null,
  slug text unique not null,
  title text not null,
  summary text,
  amount_text text,
  target_text text,
  criteria_text text,
  apply_method text,
  apply_url text,
  agency text,
  contact text,
  deadline_type text not null default 'unknown' check (deadline_type in ('always','period','unknown')),
  apply_start date,
  apply_end date,
  region_code text not null default 'ALL',
  segments text[] not null default '{}',
  status text not null default 'open' check (status in ('open','closed','removed')),
  alt_sources jsonb not null default '[]'::jsonb,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

create index benefits_status_idx on benefits (status);
create index benefits_segments_gin on benefits using gin (segments);
create index benefits_region_idx on benefits (region_code);
create index benefits_apply_end_idx on benefits (apply_end);

create table benefit_conditions (
  benefit_id uuid primary key references benefits(id) on delete cascade,
  age_min int,
  age_max int,
  gender text not null default 'any' check (gender in ('any','male','female')),
  income_bands text[] not null default '{}',
  life_stages text[] not null default '{}',
  household_types text[] not null default '{}',
  occupations text[] not null default '{}',
  region_codes text[] not null default '{}'
);

create index benefit_conditions_age_idx on benefit_conditions (age_min, age_max);
create index benefit_conditions_life_gin on benefit_conditions using gin (life_stages);
create index benefit_conditions_household_gin on benefit_conditions using gin (household_types);
create index benefit_conditions_occupations_gin on benefit_conditions using gin (occupations);

create table benefit_articles (
  benefit_id uuid primary key references benefits(id) on delete cascade,
  explainer_md text,
  steps_md text,
  faq_json jsonb not null default '[]'::jsonb,
  checklist_json jsonb not null default '[]'::jsonb,
  related_ids uuid[] not null default '{}',
  review_status text not null default 'draft' check (review_status in ('draft','reviewed','published','stale')),
  indexable boolean not null default false,
  draft_warnings jsonb not null default '[]'::jsonb,
  model text,
  drafted_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz
);

create table segments (
  slug text primary key,
  name text not null,
  description_md text,
  sort_order int not null default 0
);

create table regions (
  code text primary key,
  slug text unique not null,
  name text not null,
  description_md text
);

create table guides (
  slug text primary key,
  title text not null,
  body_md text not null,
  segment text references segments(slug),
  published_at timestamptz
);

create table sync_runs (
  id uuid primary key default uuid_generate_v4(),
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched int not null default 0,
  upserted int not null default 0,
  skipped int not null default 0,
  failed int not null default 0,
  closed int not null default 0,
  removed int not null default 0,
  error text,
  aborted_reason text
);

alter table benefits enable row level security;
alter table benefit_conditions enable row level security;
alter table benefit_articles enable row level security;
alter table segments enable row level security;
alter table regions enable row level security;
alter table guides enable row level security;
alter table sync_runs enable row level security;

create policy "public read benefits" on benefits for select using (true);
create policy "public read conditions" on benefit_conditions for select using (true);
create policy "public read articles" on benefit_articles for select using (true);
create policy "public read segments" on segments for select using (true);
create policy "public read regions" on regions for select using (true);
create policy "public read guides" on guides for select using (published_at is not null);
