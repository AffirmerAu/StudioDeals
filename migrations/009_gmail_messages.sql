-- ============================================================================
-- StudioDeals — 009: Gmail message identifiers on activities
-- Prerequisite for the Gmail add-on. Safe to re-run.
-- ============================================================================


-- ==================================================== 1. the two identifiers
-- crm.activities carries no external identifier of any kind, so there is no
-- way to tell an email that has already been filed from one that has not, and
-- every Save from the add-on would duplicate the row.
--
-- Both ids are Gmail's own opaque hex strings, not addresses — text, because
-- Google has never promised a width and there is nothing to gain from
-- guessing one.
alter table crm.activities
  add column if not exists gmail_message_id text,
  add column if not exists gmail_thread_id  text;

-- One activity per Gmail message. Partial, so it ignores the ~3,400 rows that
-- predate the add-on and every hand-logged activity that will follow them.
create unique index if not exists activities_gmail_message_id_key
  on crm.activities (gmail_message_id)
  where gmail_message_id is not null;

-- The add-on reads this one before writing, to ask which messages in the open
-- thread it already holds. Also what the app's timeline will group on if it
-- ever shows "3 emails in this thread" as a single entry.
create index if not exists activities_gmail_thread_id_idx
  on crm.activities (gmail_thread_id)
  where gmail_thread_id is not null;


-- ================================================= 2. sender -> contact lookup
-- The add-on's first job on every message is to turn an email address into a
-- contact, and addresses arrive from Gmail cased however the sender's client
-- felt like casing them.
--
-- 001 already indexes crm.contacts (lower(email)) — but PostgREST cannot put a
-- function on the column side of a filter, so ?email=ilike.<addr> would seq
-- scan past the index it needs. An RPC can, and gets the index.
--
-- Returns v_contacts_list rather than crm.contacts so the card has the
-- organisation name, the client flag and the stale flag without a second
-- round trip — and so it keeps following the view if that gains a column.
create or replace function crm.find_contacts_by_email(addr text)
returns setof crm.v_contacts_list
language sql
stable
as $$
  select *
  from crm.v_contacts_list
  where lower(email) = lower(trim(addr))
  order by is_primary desc, last_name nulls last, first_name;
$$;

grant execute on function crm.find_contacts_by_email(text) to authenticated;
