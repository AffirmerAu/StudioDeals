-- ============================================================================
-- StudioDeals — Phase 2 (organisations & contacts) support views
-- Run in the SQL Editor of the StudioDeals Supabase project, after 001 and 002.
-- ============================================================================

-- ---------- Organisation list aggregates ----------
-- Powers the organisations list page: contact count, open deal count, and
-- total won value per organisation, computed server-side so the list page
-- can page/sort/filter without pulling all 603 rows or issuing N+1 queries.
create or replace view crm.v_organisation_summary as
select
  o.id,
  o.name,
  o.industry,
  o.website,
  o.abn,
  o.account_number,
  o.address,
  o.is_client,
  o.notes,
  o.created_at,
  o.updated_at,
  coalesce(c.contact_count, 0)    as contact_count,
  coalesce(d.open_deal_count, 0)  as open_deal_count,
  coalesce(d.won_value_cents, 0)  as won_value_cents
from crm.organisations o
left join (
  select organisation_id, count(*) as contact_count
  from crm.contacts
  where organisation_id is not null
  group by organisation_id
) c on c.organisation_id = o.id
left join (
  select
    d.organisation_id,
    count(*) filter (where s.is_won = false and s.is_lost = false) as open_deal_count,
    sum(d.value_cents) filter (where s.is_won = true)               as won_value_cents
  from crm.deals d
  join crm.pipeline_stages s on s.id = d.stage_id
  group by d.organisation_id
) d on d.organisation_id = o.id;

-- ---------- Contacts list ----------
-- Flattens organisation name onto the contact row (so search/sort/pagination
-- don't need resource embedding) and reuses crm.v_stale_contacts to flag
-- contacts who haven't been contacted in 60+ days.
create or replace view crm.v_contacts_list as
select
  c.id,
  c.organisation_id,
  c.first_name,
  c.last_name,
  c.role,
  c.email,
  c.phone,
  c.is_primary,
  c.last_contacted_at,
  c.notes,
  c.created_at,
  c.updated_at,
  o.name as organisation_name,
  (v.id is not null) as is_stale
from crm.contacts c
left join crm.organisations o     on o.id = c.organisation_id
left join crm.v_stale_contacts v  on v.id = c.id;

-- Both views inherit the "authenticated can see everything" posture already
-- in place for the base tables (see 001 PART 4) — no separate grants needed.
