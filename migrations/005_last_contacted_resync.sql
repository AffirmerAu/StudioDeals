-- Recompute contacts.last_contacted_at on update and delete, not just insert.
--
-- The original trigger fired only on INSERT and used greatest(), so the value
-- could go up but never down. Now that activities can be edited and deleted
-- (PR #9), two states were unreachable-but-wrong:
--
--   * re-pointing a call at a different contact left the first contact's date
--     refreshed and never gave the second one theirs;
--   * deleting a mis-logged call left the contact still looking recently
--     contacted, which is exactly the staleness flag this column drives.
--
-- Recomputing from the activities table fixes both, but on its own it would
-- destroy data: the Capsule import set last_contacted_at directly, and not
-- every historical interaction came across as an activity row. So the portion
-- no activity explains is preserved first, as a floor.

-- ---------------------------------------------------------------- 1. baseline
alter table crm.contacts
  add column if not exists last_contacted_baseline timestamptz;

comment on column crm.contacts.last_contacted_baseline is
  'Imported last-contacted date kept as a floor, because not every historical '
  'interaction exists as an activity row. last_contacted_at is recomputed as '
  'greatest(this, max activity occurred_at).';

-- Only where the current value is higher than any activity can account for —
-- that difference is precisely the imported-only portion. Safe to re-run:
-- rows already carrying a baseline are unaffected by a second pass, since the
-- baseline is itself included in what last_contacted_at now reflects.
update crm.contacts c
   set last_contacted_baseline = c.last_contacted_at
 where c.last_contacted_baseline is null
   and c.last_contacted_at is not null
   and c.last_contacted_at > coalesce((
         select max(a.occurred_at)
           from crm.activities a
          where a.contact_id = c.id
            and a.type in ('call','email','meeting','site_visit','quote_sent')
       ), '-infinity'::timestamptz);

-- --------------------------------------------------------------- 2. recompute
-- GREATEST ignores NULLs in Postgres and yields NULL only when every argument
-- is NULL, which is exactly the wanted behaviour: a contact with no baseline
-- and no remaining activities correctly goes back to "never contacted".
create or replace function crm.recompute_last_contacted(target uuid)
returns void language sql as $$
  update crm.contacts c
     set last_contacted_at = greatest(
           c.last_contacted_baseline,
           (select max(a.occurred_at)
              from crm.activities a
             where a.contact_id = target
               and a.type in ('call','email','meeting','site_visit','quote_sent'))
         )
   where c.id = target;
$$;

-- ----------------------------------------------------------------- 3. trigger
create or replace function crm.sync_last_contacted()
returns trigger language plpgsql as $$
begin
  -- The contact the row points at now.
  if tg_op in ('INSERT', 'UPDATE') and new.contact_id is not null then
    perform crm.recompute_last_contacted(new.contact_id);
  end if;

  -- The contact it pointed at before: an update can move an activity to
  -- another contact or off one entirely, and a delete removes it outright.
  if tg_op in ('UPDATE', 'DELETE')
     and old.contact_id is not null
     and (tg_op = 'DELETE' or old.contact_id is distinct from new.contact_id) then
    perform crm.recompute_last_contacted(old.contact_id);
  end if;

  return null;  -- AFTER trigger; the return value is discarded
end $$;

drop trigger if exists t_activity_touches_contact on crm.activities;

create trigger t_activity_touches_contact
  after insert or update or delete on crm.activities
  for each row execute function crm.sync_last_contacted();

-- ------------------------------------------------------------------ 4. repair
-- Bring every contact in line with the new rule in one pass, so rows already
-- wrong from before the fix are corrected rather than waiting for their next
-- activity edit.
update crm.contacts c
   set last_contacted_at = greatest(
         c.last_contacted_baseline,
         (select max(a.occurred_at)
            from crm.activities a
           where a.contact_id = c.id
             and a.type in ('call','email','meeting','site_visit','quote_sent'))
       );
