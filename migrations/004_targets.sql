-- Monthly targets for the dashboard tiles.
--
-- One standing row rather than a row per month: the tiles compare the current
-- month against a target that stays put until it's changed. If per-month
-- history is wanted later, this becomes (period date, ...) with the primary
-- key on period, and the app starts asking for a specific month.
--
-- Money is integer cents, matching crm.deals.value_cents.

create table if not exists crm.targets (
  id                          smallint primary key default 1 check (id = 1),
  new_deals_per_month         integer not null default 0 check (new_deals_per_month >= 0),
  won_deals_per_month         integer not null default 0 check (won_deals_per_month >= 0),
  won_value_cents_per_month   bigint  not null default 0 check (won_value_cents_per_month >= 0),
  updated_at                  timestamptz not null default now()
);

-- The single row the app reads and updates. Safe to re-run.
insert into crm.targets (id) values (1) on conflict (id) do nothing;

alter table crm.targets enable row level security;

drop policy if exists p_all on crm.targets;
create policy p_all on crm.targets for all to authenticated using (true) with check (true);
