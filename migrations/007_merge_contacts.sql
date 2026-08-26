-- Contact merging, and a readable view over the merge log.
--
-- 006 did organisations. crm.merge_log.entity_type has always allowed
-- 'contact' but nothing ever wrote one, because there was no duplicate view
-- for contacts and no function to act on it. Both are added here.
--
-- The merge log itself has been written since 006 and read by nobody. It
-- holds the only copy of what a merged-away record contained, so it is the
-- nearest thing to an undo — v_merge_log makes it visible.

-- ============================================================== 1. duplicates
-- Name similarity alone is the wrong test for people: two different "John
-- Smith"s at two different clients are two different people, and the same
-- person often appears under "Bob" and "Robert". So a pair qualifies on
-- either of two much stronger signals:
--
--   * the same email address, whatever the name or organisation — one inbox
--     is one person;
--   * a similar name AT THE SAME ORGANISATION, which is the case the trigram
--     index on (first_name || ' ' || last_name) exists to serve.
--
-- Contacts with no email and no organisation are never paired: there would be
-- nothing to distinguish a genuine duplicate from a namesake.
create or replace view crm.v_possible_duplicate_contacts as
with c as (
  select id, organisation_id, email, created_at,
         trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) as full_name
    from crm.contacts
)
select
  a.id                as id_a,
  a.full_name         as name_a,
  a.email             as email_a,
  b.id                as id_b,
  b.full_name         as name_b,
  b.email             as email_b,
  o.name              as organisation_name,
  case
    when a.email is not null and lower(a.email) = lower(b.email) then 'email'
    else 'name'
  end                 as match_on,
  case
    when a.email is not null and lower(a.email) = lower(b.email) then 1::real
    else similarity(a.full_name, b.full_name)
  end                 as score
from c a
join c b
  on a.id < b.id
left join crm.organisations o
  on o.id = coalesce(a.organisation_id, b.organisation_id)
where (
        a.email is not null and b.email is not null
        and lower(a.email) = lower(b.email)
      )
   or (
        a.organisation_id is not null
        and a.organisation_id = b.organisation_id
        and similarity(a.full_name, b.full_name) > 0.45
      )
order by score desc, name_a;

-- ==================================================================== 2. merge
-- Same shape as merge_organisations, and dangerous to fake with a DELETE for
-- the same reason — the FKs quietly destroy or detach history:
--
--   crm.deals.primary_contact_id  ON DELETE SET NULL  -> deal loses its contact
--   crm.activities.contact_id     ON DELETE SET NULL  -> call loses its person
--   crm.taggings.contact_id       ON DELETE CASCADE   -> tags destroyed
--
-- so every child is repointed before the row goes, all in one function.
create or replace function crm.merge_contacts(survivor uuid, loser uuid)
returns void
language plpgsql
as $$
declare
  snapshot jsonb;
begin
  if survivor = loser then
    raise exception 'Cannot merge a contact into itself';
  end if;

  -- Snapshot before anything changes: merged_snapshot is the only record of
  -- what the duplicate held, including the fields not carried across.
  select to_jsonb(c) into snapshot from crm.contacts c where c.id = loser;
  if snapshot is null then
    raise exception 'Contact % not found', loser;
  end if;
  if not exists (select 1 from crm.contacts where id = survivor) then
    raise exception 'Contact % not found', survivor;
  end if;

  -- Fill only the survivor's blanks; its own values always win. first_name is
  -- what makes it the survivor, so it is never touched, and legacy_capsule_id
  -- is deliberately not carried: it is an import artefact under a unique
  -- index, and taking it while the loser still holds it would collide. The
  -- snapshot keeps it either way.
  --
  -- GREATEST ignores NULLs and yields NULL only when every argument is NULL,
  -- so a baseline is picked up from whichever contact has one.
  update crm.contacts s set
    organisation_id         = coalesce(s.organisation_id, l.organisation_id),
    last_name               = coalesce(s.last_name, l.last_name),
    role                    = coalesce(s.role, l.role),
    email                   = coalesce(s.email, l.email),
    phone                   = coalesce(s.phone, l.phone),
    notes                   = coalesce(s.notes, l.notes),
    is_primary              = s.is_primary or l.is_primary,
    last_contacted_baseline = greatest(s.last_contacted_baseline, l.last_contacted_baseline),
    updated_at              = now()
  from crm.contacts l
  where s.id = survivor and l.id = loser;

  update crm.deals      set primary_contact_id = survivor where primary_contact_id = loser;
  update crm.activities set contact_id         = survivor where contact_id         = loser;

  -- A tag both contacts carry would collide with the partial unique index on
  -- (tag_id, contact_id), so drop the duplicate's copy first and move only the
  -- tags the survivor is missing.
  delete from crm.taggings t
   where t.contact_id = loser
     and exists (
       select 1 from crm.taggings s
        where s.contact_id = survivor and s.tag_id = t.tag_id
     );
  update crm.taggings set contact_id = survivor where contact_id = loser;

  insert into crm.merge_log (entity_type, survivor_id, merged_id, merged_snapshot, merged_by)
  values ('contact', survivor, loser, snapshot, auth.uid());

  delete from crm.contacts where id = loser;

  -- Moving the activities fires the 005 trigger, but only if there were any.
  -- A merged baseline with no activities behind it would otherwise leave
  -- last_contacted_at stale, so recompute once at the end regardless.
  perform crm.recompute_last_contacted(survivor);
end $$;

grant execute on function crm.merge_contacts(uuid, uuid) to authenticated;

-- ================================================================ 3. the log
-- merged_snapshot is the whole deleted row, so it can name what was merged
-- away long after the record itself is gone. survivor_name comes from the
-- live table instead and is NULL when the survivor has since been merged away
-- or deleted itself — worth showing as such rather than papering over.
create or replace view crm.v_merge_log as
select
  m.id,
  m.entity_type,
  m.survivor_id,
  m.merged_id,
  m.merged_at,
  m.merged_by,
  case m.entity_type
    when 'organisation' then m.merged_snapshot ->> 'name'
    else nullif(trim(coalesce(m.merged_snapshot ->> 'first_name', '') || ' ' ||
                     coalesce(m.merged_snapshot ->> 'last_name', '')), '')
  end as merged_name,
  -- nullif, because concatenating a missed LEFT JOIN yields '' rather than
  -- NULL and the caller has to be able to tell "gone" from "blank name".
  case m.entity_type
    when 'organisation' then o.name
    else nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '')
  end as survivor_name,
  m.merged_snapshot
from crm.merge_log m
left join crm.organisations o on m.entity_type = 'organisation' and o.id = m.survivor_id
left join crm.contacts      c on m.entity_type = 'contact'      and c.id = m.survivor_id
order by m.merged_at desc;

-- All three inherit the "authenticated can see everything" posture already in
-- place for the base tables (see 001 PART 4) — no separate grants needed.
