-- ============================================================================
-- StudioDeals — Phase 0 (schema) + Phase 0.5 (Capsule import)
-- Run in the SQL Editor of the StudioDeals Supabase project.
-- Run each PART separately and check the output before moving on.
-- ============================================================================


-- ============================================================================
-- PART 1 — CORE SCHEMA
-- ============================================================================

create schema if not exists crm;
create extension if not exists pg_trgm;

-- ---------- Organisations ----------
create table crm.organisations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  industry          text,
  website           text,
  abn               text,
  account_number    text,              -- AFA-nnn, reference only
  address           text,
  is_client         boolean not null default false,
  notes             text,
  legacy_capsule_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on crm.organisations (lower(name));
create index on crm.organisations using gin (name gin_trgm_ops);
create index on crm.organisations (is_client);
create unique index on crm.organisations (legacy_capsule_id)
  where legacy_capsule_id is not null;

-- ---------- Contacts ----------
create table crm.contacts (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid references crm.organisations(id) on delete set null,
  first_name        text not null,
  last_name         text,
  role              text,
  email             text,
  phone             text,
  is_primary        boolean not null default false,
  last_contacted_at timestamptz,
  notes             text,
  legacy_capsule_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on crm.contacts (organisation_id);
create index on crm.contacts (lower(email));
create index on crm.contacts (last_contacted_at nulls first);
create index on crm.contacts using gin ((coalesce(first_name,'') || ' ' || coalesce(last_name,'')) gin_trgm_ops);
create unique index on crm.contacts (legacy_capsule_id)
  where legacy_capsule_id is not null;

-- ---------- Pipeline stages (mirrors your Capsule pipeline) ----------
create table crm.pipeline_stages (
  id           smallint primary key,
  key          text not null unique,
  label        text not null,
  position     smallint not null,
  probability  numeric(3,2) not null default 0,
  is_won       boolean not null default false,
  is_lost      boolean not null default false
);

insert into crm.pipeline_stages (id, key, label, position, probability, is_won, is_lost) values
  (1, 'new',      'New',             1, 0.10, false, false),
  (2, 'meeting',  'Meeting',         2, 0.30, false, false),
  (3, 'proposal', 'Proposal',        3, 0.50, false, false),
  (4, 'verbal',   'Verbal Approval', 4, 0.90, false, false),
  (5, 'won',      'Won',             5, 1.00, true,  false),
  (6, 'lost',     'Lost',            6, 0.00, false, true);

-- ---------- Deals ----------
create table crm.deals (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  organisation_id       uuid not null references crm.organisations(id) on delete restrict,
  primary_contact_id    uuid references crm.contacts(id) on delete set null,
  stage_id              smallint not null references crm.pipeline_stages(id) default 1,
  deal_type             text not null default 'production'
                          check (deal_type in ('production','prestarter','retainer','other')),
  value_cents           bigint not null default 0,
  currency              char(3) not null default 'AUD',
  expected_close_date   date,
  probability_override  numeric(3,2),
  board_position        numeric not null default 1000,
  source                text,
  won_at                timestamptz,
  lost_at               timestamptz,
  lost_reason           text,
  handed_off_at         timestamptz,
  studiotime_project_id uuid,
  notes                 text,
  legacy_capsule_id     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index on crm.deals (stage_id, board_position);
create index on crm.deals (organisation_id);
create index on crm.deals (expected_close_date);
create unique index on crm.deals (legacy_capsule_id)
  where legacy_capsule_id is not null;

-- ---------- Activities ----------
create table crm.activities (
  id               uuid primary key default gen_random_uuid(),
  deal_id          uuid references crm.deals(id) on delete cascade,
  contact_id       uuid references crm.contacts(id) on delete set null,
  organisation_id  uuid references crm.organisations(id) on delete cascade,
  type             text not null
                     check (type in ('call','email','meeting','site_visit',
                                     'quote_sent','note','task')),
  subject          text,
  notes            text,
  occurred_at      timestamptz not null default now(),
  due_at           timestamptz,
  completed_at     timestamptz,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index on crm.activities (deal_id, occurred_at desc);
create index on crm.activities (contact_id, occurred_at desc);
create index on crm.activities (organisation_id, occurred_at desc);
create index on crm.activities (due_at) where completed_at is null;

-- ---------- Tags ----------
create table crm.tags (
  id    smallserial primary key,
  label text not null unique,
  kind  text not null default 'label'
          check (kind in ('label','source','industry','event'))
);

-- NOTE: a PK cannot contain an expression, so the exclusivity is enforced
-- with a CHECK plus two partial unique indexes.
create table crm.taggings (
  id              bigserial primary key,
  tag_id          smallint not null references crm.tags(id) on delete cascade,
  organisation_id uuid references crm.organisations(id) on delete cascade,
  contact_id      uuid references crm.contacts(id) on delete cascade,
  check (num_nonnulls(organisation_id, contact_id) = 1)
);

create unique index on crm.taggings (tag_id, organisation_id) where organisation_id is not null;
create unique index on crm.taggings (tag_id, contact_id)      where contact_id      is not null;
create index on crm.taggings (organisation_id);
create index on crm.taggings (contact_id);

-- ---------- Merge audit ----------
create table crm.merge_log (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null check (entity_type in ('contact','organisation')),
  survivor_id     uuid not null,
  merged_id       uuid not null,
  merged_snapshot jsonb not null,
  merged_by       uuid references auth.users(id),
  merged_at       timestamptz not null default now()
);


-- ============================================================================
-- PART 2 — TRIGGERS
-- ============================================================================

create or replace function crm.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger t_orgs_touch     before update on crm.organisations
  for each row execute function crm.touch_updated_at();
create trigger t_contacts_touch before update on crm.contacts
  for each row execute function crm.touch_updated_at();
create trigger t_deals_touch    before update on crm.deals
  for each row execute function crm.touch_updated_at();

create or replace function crm.sync_last_contacted()
returns trigger language plpgsql as $$
begin
  if new.contact_id is not null
     and new.type in ('call','email','meeting','site_visit','quote_sent') then
    update crm.contacts
       set last_contacted_at = greatest(
             coalesce(last_contacted_at, new.occurred_at), new.occurred_at)
     where id = new.contact_id;
  end if;
  return new;
end $$;

create trigger t_activity_touches_contact after insert on crm.activities
  for each row execute function crm.sync_last_contacted();

create or replace function crm.stamp_deal_outcome()
returns trigger language plpgsql as $$
declare s crm.pipeline_stages%rowtype;
begin
  select * into s from crm.pipeline_stages where id = new.stage_id;
  if s.is_won  and new.won_at  is null then new.won_at  := now(); end if;
  if s.is_lost and new.lost_at is null then new.lost_at := now(); end if;
  if not s.is_won  then new.won_at  := null; end if;
  if not s.is_lost then new.lost_at := null; end if;
  return new;
end $$;

create trigger t_deal_outcome before insert or update of stage_id on crm.deals
  for each row execute function crm.stamp_deal_outcome();


-- ============================================================================
-- PART 3 — VIEWS
-- ============================================================================

create or replace view crm.v_pipeline_forecast as
select
  date_trunc('month', d.expected_close_date)::date  as forecast_month,
  d.deal_type,
  count(*)                                          as deal_count,
  sum(d.value_cents)                                as gross_value_cents,
  sum(round(d.value_cents
        * coalesce(d.probability_override, s.probability)))::bigint
                                                    as weighted_value_cents
from crm.deals d
join crm.pipeline_stages s on s.id = d.stage_id
where s.is_won = false and s.is_lost = false
  and d.expected_close_date is not null
group by 1, 2;

create or replace view crm.v_pending_handoff as
select d.id, d.title, d.won_at, o.name as organisation_name
from crm.deals d
join crm.pipeline_stages s on s.id = d.stage_id
join crm.organisations o   on o.id = d.organisation_id
where s.is_won = true
  and d.deal_type = 'production'
  and d.handed_off_at is null;

create or replace view crm.v_deals_needing_attention as
select d.id, d.title, o.name as organisation_name, s.label as stage,
       (d.value_cents = 0)                    as missing_value,
       (d.expected_close_date is null)        as missing_close_date,
       (d.expected_close_date < current_date) as close_date_passed
from crm.deals d
join crm.pipeline_stages s on s.id = d.stage_id
join crm.organisations o   on o.id = d.organisation_id
where s.is_won = false and s.is_lost = false
  and (d.value_cents = 0
       or d.expected_close_date is null
       or d.expected_close_date < current_date);

create or replace view crm.v_stale_contacts as
select c.*, o.name as organisation_name,
       now() - c.last_contacted_at as since_contact
from crm.contacts c
left join crm.organisations o on o.id = c.organisation_id
where o.is_client = true
  and (c.last_contacted_at is null
       or c.last_contacted_at < now() - interval '60 days');

create or replace view crm.v_possible_duplicate_orgs as
select a.id as id_a, a.name as name_a, b.id as id_b, b.name as name_b,
       similarity(a.name, b.name) as score
from crm.organisations a
join crm.organisations b
  on a.id < b.id and similarity(a.name, b.name) > 0.45
order by score desc;


-- ============================================================================
-- PART 4 — RLS
-- Every user in this project is an admin. Enable RLS anyway: without it,
-- anyone holding the anon key can read these tables.
-- ⚠️ Also disable public signup: Authentication -> Providers -> Email ->
--    turn OFF "Enable sign ups". Then invite yourself and James manually.
-- ============================================================================

alter table crm.organisations   enable row level security;
alter table crm.contacts        enable row level security;
alter table crm.deals           enable row level security;
alter table crm.activities      enable row level security;
alter table crm.pipeline_stages enable row level security;
alter table crm.tags            enable row level security;
alter table crm.taggings        enable row level security;
alter table crm.merge_log       enable row level security;

create policy p_all on crm.organisations   for all to authenticated using (true) with check (true);
create policy p_all on crm.contacts        for all to authenticated using (true) with check (true);
create policy p_all on crm.deals           for all to authenticated using (true) with check (true);
create policy p_all on crm.activities      for all to authenticated using (true) with check (true);
create policy p_all on crm.tags            for all to authenticated using (true) with check (true);
create policy p_all on crm.taggings        for all to authenticated using (true) with check (true);
create policy p_all on crm.merge_log       for all to authenticated using (true) with check (true);
create policy p_read on crm.pipeline_stages for select to authenticated using (true);

-- Finally: Settings -> API -> Exposed schemas -> add `crm`


-- ============================================================================
-- PART 5 — STAGING TABLES
-- All columns are TEXT. Supabase's CSV importer loads blanks as empty strings,
-- which fail on date/uuid/numeric columns — so cast on merge with nullif().
-- ============================================================================

create schema if not exists staging;

drop table if exists staging.organisations, staging.contacts,
                     staging.deals, staging.activities;

create table staging.organisations (
  id text, name text, industry text, website text, abn text,
  account_number text, address text, is_client text, tags text,
  notes text, legacy_capsule_id text, created_at text
);

create table staging.contacts (
  id text, organisation_id text, first_name text, last_name text, role text,
  email text, phone text, last_contacted_at text, tags text,
  notes text, legacy_capsule_id text, created_at text
);

create table staging.deals (
  id text, title text, organisation_id text, stage_id text, deal_type text,
  value_cents text, expected_close_date text, won_at text, lost_at text,
  lost_reason text, handed_off_at text, source text, notes text,
  legacy_capsule_id text, created_at text
);

create table staging.activities (
  id text, deal_id text, contact_id text, organisation_id text,
  type text, subject text, notes text, occurred_at text
);

-- ⏸  STOP HERE.
--    Table Editor -> staging.organisations -> Insert -> Import data from CSV.
--    Upload all four CSVs before continuing. Order doesn't matter for staging.


-- ============================================================================
-- PART 6 — MERGE INTO crm
-- Idempotent: IDs are uuid5-derived from Capsule IDs, so re-running against a
-- newer export UPDATES existing rows rather than duplicating them.
-- Order matters here — foreign keys require orgs -> contacts -> deals -> activities.
-- ============================================================================

begin;

-- ---------- Organisations ----------
insert into crm.organisations
  (id, name, industry, website, abn, account_number, address,
   is_client, notes, legacy_capsule_id, created_at)
select
  s.id::uuid,
  s.name,
  nullif(s.industry, ''),
  nullif(s.website, ''),
  nullif(s.abn, ''),
  nullif(s.account_number, ''),
  nullif(s.address, ''),
  s.is_client = 'true',
  nullif(s.notes, ''),
  s.legacy_capsule_id,
  coalesce(nullif(s.created_at, '')::timestamptz, now())
from staging.organisations s
on conflict (id) do update set
  name           = excluded.name,
  industry       = excluded.industry,
  website        = excluded.website,
  abn            = excluded.abn,
  account_number = excluded.account_number,
  address        = excluded.address,
  is_client      = excluded.is_client,
  notes          = excluded.notes;

-- ---------- Contacts ----------
insert into crm.contacts
  (id, organisation_id, first_name, last_name, role, email, phone,
   last_contacted_at, notes, legacy_capsule_id, created_at)
select
  s.id::uuid,
  nullif(s.organisation_id, '')::uuid,
  s.first_name,
  nullif(s.last_name, ''),
  nullif(s.role, ''),
  nullif(s.email, ''),
  nullif(s.phone, ''),
  nullif(s.last_contacted_at, '')::timestamptz,
  nullif(s.notes, ''),
  s.legacy_capsule_id,
  coalesce(nullif(s.created_at, '')::timestamptz, now())
from staging.contacts s
on conflict (id) do update set
  organisation_id   = excluded.organisation_id,
  first_name        = excluded.first_name,
  last_name         = excluded.last_name,
  role              = excluded.role,
  email             = excluded.email,
  phone             = excluded.phone,
  last_contacted_at = excluded.last_contacted_at,
  notes             = excluded.notes;

-- ---------- Deals ----------
-- board_position spaces cards 1000 apart within each stage so fractional
-- midpoint reordering has room to work without an immediate reindex.
insert into crm.deals
  (id, title, organisation_id, stage_id, deal_type, value_cents,
   expected_close_date, won_at, lost_at, lost_reason, handed_off_at,
   source, notes, board_position, legacy_capsule_id, created_at)
select
  s.id::uuid,
  s.title,
  s.organisation_id::uuid,
  s.stage_id::smallint,
  s.deal_type,
  s.value_cents::bigint,
  nullif(s.expected_close_date, '')::date,
  nullif(s.won_at, '')::timestamptz,
  nullif(s.lost_at, '')::timestamptz,
  nullif(s.lost_reason, ''),
  nullif(s.handed_off_at, '')::timestamptz,
  nullif(s.source, ''),
  nullif(s.notes, ''),
  row_number() over (partition by s.stage_id
                     order by nullif(s.created_at,'')::date desc nulls last) * 1000,
  s.legacy_capsule_id,
  coalesce(nullif(s.created_at, '')::timestamptz, now())
from staging.deals s
on conflict (id) do update set
  title               = excluded.title,
  organisation_id     = excluded.organisation_id,
  stage_id            = excluded.stage_id,
  value_cents         = excluded.value_cents,
  expected_close_date = excluded.expected_close_date,
  won_at              = excluded.won_at,
  lost_at             = excluded.lost_at,
  lost_reason         = excluded.lost_reason,
  handed_off_at       = excluded.handed_off_at,
  source              = excluded.source,
  notes               = excluded.notes;
  -- board_position deliberately NOT updated: re-import must not reshuffle
  -- cards you've already dragged into position.

-- ---------- Activities ----------
insert into crm.activities
  (id, deal_id, contact_id, organisation_id, type, subject, notes, occurred_at)
select
  s.id::uuid,
  nullif(s.deal_id, '')::uuid,
  nullif(s.contact_id, '')::uuid,
  nullif(s.organisation_id, '')::uuid,
  s.type,
  nullif(s.subject, ''),
  nullif(s.notes, ''),
  nullif(s.occurred_at, '')::timestamptz
from staging.activities s
where nullif(s.occurred_at, '') is not null
on conflict (id) do nothing;   -- imported history is immutable

-- ---------- Tags ----------
insert into crm.tags (label, kind)
select distinct trim(t.tag),
       case
         when trim(t.tag) in ('WHS Show Sydney 2024','WHS Show Sydney 2025',
                              'NSCA National Conference 2025')       then 'event'
         when trim(t.tag) in ('Lemlist Contacts','LinkedIn Campaign',
                              'LinkedIn','Referral','Web Contact')   then 'source'
         when trim(t.tag) in ('Healthcare','Mining')                 then 'industry'
         else 'label'
       end
from (
  select unnest(string_to_array(tags, '|')) as tag from staging.organisations
  union all
  select unnest(string_to_array(tags, '|')) as tag from staging.contacts
) t
where trim(coalesce(t.tag, '')) <> ''
on conflict (label) do nothing;

insert into crm.taggings (tag_id, organisation_id)
select tg.id, s.id::uuid
from staging.organisations s
cross join lateral unnest(string_to_array(s.tags, '|')) as u(tag)
join crm.tags tg on tg.label = trim(u.tag)
where trim(coalesce(u.tag, '')) <> ''
on conflict do nothing;

insert into crm.taggings (tag_id, contact_id)
select tg.id, s.id::uuid
from staging.contacts s
cross join lateral unnest(string_to_array(s.tags, '|')) as u(tag)
join crm.tags tg on tg.label = trim(u.tag)
where trim(coalesce(u.tag, '')) <> ''
on conflict do nothing;

commit;


-- ============================================================================
-- PART 7 — VERIFY
-- Expected values are from the test export. They will shift on the final one.
-- ============================================================================

select 'organisations' as entity, count(*) as actual, 603 as expected_test from crm.organisations
union all select 'contacts',   count(*),  643 from crm.contacts
union all select 'deals',      count(*),  257 from crm.deals
union all select 'activities', count(*), 3415 from crm.activities;

-- Won total: expect 133 deals / $1,702,576
select count(*) as won_deals, (sum(value_cents)/100.0)::money as won_value
from crm.deals d join crm.pipeline_stages s on s.id = d.stage_id
where s.is_won;

-- MUST be 0 — historical wins are already in StudioTime
select count(*) as pending_handoff_should_be_zero from crm.v_pending_handoff;

-- MUST be 0 — no orphaned deals
select count(*) as orphan_deals from crm.deals d
left join crm.organisations o on o.id = d.organisation_id
where o.id is null;

-- Deals per stage
select s.label, count(d.id), (sum(d.value_cents)/100.0)::money
from crm.pipeline_stages s
left join crm.deals d on d.stage_id = s.id
group by s.id, s.label order by s.position;

-- Expect ~5 rows until the close dates are filled in
select * from crm.v_pipeline_forecast order by forecast_month;

-- Expect ~40 rows
select count(*) as needs_attention from crm.v_deals_needing_attention;

-- Expect 137 true
select is_client, count(*) from crm.organisations group by is_client;


-- ============================================================================
-- PART 8 — CLEAN UP (only after verification passes)
-- ============================================================================
-- drop schema staging cascade;
