-- ============================================================================
-- StudioDeals — Phase 2 (organisations & contacts) support views
-- Run in the SQL Editor of the StudioDeals Supabase project, after 001 and 002.
-- ============================================================================
--
-- ⚠️ This file was originally written as a proposal and the views were then
-- built differently by hand, so for a long time it did not describe what was
-- actually live. It has since been reconciled against the live definitions.
-- Column names, types and order match exactly, so both statements replace the
-- live views in place.
--
-- v_organisation_summary is the one deliberate departure: the live definition
-- double-counted deal values, and the note on it below explains what changed
-- and why.
--
-- Two things that catch people out on these views:
--
--   * neither carries updated_at, though an earlier version of this file
--     selected it. Code that needs a contact's updated_at has to read
--     crm.contacts, which is why ContactEditableFields is a Pick rather than
--     the whole row;
--   * every column comes back nullable from `supabase gen types`, whatever
--     the underlying constraints — Postgres view introspection does not
--     propagate NOT NULL and there is no SQL fix. types/crm.ts narrows the
--     handful that the view definitions themselves prove non-null.

-- ---------- Organisation list aggregates ----------
-- Powers the organisations list page: per-organisation counts and values,
-- computed server-side so the list can page/sort/filter without pulling all
-- 603 rows or issuing N+1 queries.
--
-- ⚠️ This is NOT a verbatim copy of what was live. The live definition joined
-- contacts and deals flat off the same organisation:
--
--     from crm.organisations o
--     left join crm.contacts c on c.organisation_id = o.id
--     left join crm.deals    d on d.organisation_id = o.id
--
-- which is a cartesian product — an organisation with 3 contacts and 2 deals
-- produces 6 rows. The counts survived that, because they were written as
-- count(distinct ...), but the two sums were not, so every deal's value was
-- counted once per contact. Three organisations holding identical deals
-- reported $10,000, $10,000 and $30,000 of won value depending only on how
-- many people were attached to them. won_value_cents is shown and sortable on
-- the organisations list, so the numbers on that page were wrong.
--
-- Aggregating each side separately before joining is what fixes it: the
-- subqueries below produce at most one row per organisation each, so there is
-- nothing to multiply. Column names, types and order are unchanged from the
-- live view, so this replaces it in place.
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
  coalesce(c.contact_count, 0)    as contact_count,
  coalesce(d.deal_count, 0)       as deal_count,
  coalesce(d.open_deal_count, 0)  as open_deal_count,
  coalesce(d.open_value_cents, 0) as open_value_cents,
  coalesce(d.won_value_cents, 0)  as won_value_cents,
  c.last_contacted_at
from crm.organisations o
left join (
  select
    organisation_id,
    count(*)               as contact_count,
    -- The organisation is as recently contacted as its most recently
    -- contacted person.
    max(last_contacted_at) as last_contacted_at
  from crm.contacts
  where organisation_id is not null
  group by organisation_id
) c on c.organisation_id = o.id
left join (
  select
    d.organisation_id,
    count(*)                                               as deal_count,
    count(*) filter (where not s.is_won and not s.is_lost) as open_deal_count,
    -- Open value, not total: won and lost only accumulate, so a running total
    -- of everything says nothing about the account today. Matches the "Open
    -- pipeline value" the dashboard reports.
    coalesce(sum(d.value_cents) filter (where not s.is_won and not s.is_lost), 0)::bigint
                                                           as open_value_cents,
    coalesce(sum(d.value_cents) filter (where s.is_won), 0)::bigint
                                                           as won_value_cents
  from crm.deals d
  join crm.pipeline_stages s on s.id = d.stage_id
  group by d.organisation_id
) d on d.organisation_id = o.id;

-- ---------- Contacts list ----------
-- Flattens the organisation's name, industry and client flag onto the contact
-- row, so search/sort/pagination don't need resource embedding, and reuses
-- crm.v_stale_contacts to flag anyone not contacted in 60+ days.
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
  o.name     as organisation_name,
  o.industry as organisation_industry,
  o.is_client,
  -- A boolean expression, so unlike every other column here it is genuinely
  -- never null — types/crm.ts narrows it on that basis.
  (v.id is not null) as is_stale
from crm.contacts c
left join crm.organisations o     on o.id = c.organisation_id
left join crm.v_stale_contacts v  on v.id = c.id;

-- Both views inherit the "authenticated can see everything" posture already
-- in place for the base tables (see 001 PART 4) — no separate grants needed.
