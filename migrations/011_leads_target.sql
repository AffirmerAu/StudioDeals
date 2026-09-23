-- ============================================================================
-- StudioDeals — 011: a monthly target for new leads
-- Safe to re-run.
-- ============================================================================

-- A lead is a contact created this month — a person newly in the CRM, before
-- any of it becomes a deal. That is deliberately not the same count as
-- "New deals this month", which the dashboard already shows: three people at
-- one client are three leads and, if it goes anywhere, one deal.
--
-- Same shape as the targets beside it: one standing row, not a row per month,
-- so the tile compares this month against a number that stays put until it is
-- changed.
alter table crm.targets
  add column if not exists new_leads_per_month integer not null default 0
    check (new_leads_per_month >= 0);
