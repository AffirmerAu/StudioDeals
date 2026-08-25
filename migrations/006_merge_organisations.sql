-- Merge one organisation into another, atomically.
--
-- v_possible_duplicate_orgs has existed since 001 and nothing ever consumed
-- it; crm.merge_log likewise. This is the function behind both.
--
-- The FKs make a naive "delete the duplicate" actively dangerous:
--
--   crm.deals.organisation_id       NOT NULL, ON DELETE RESTRICT  -> delete fails
--   crm.activities.organisation_id  ON DELETE CASCADE             -> history destroyed
--   crm.taggings.organisation_id    ON DELETE CASCADE             -> tags destroyed
--   crm.contacts.organisation_id    ON DELETE SET NULL            -> contacts orphaned
--
-- So every child is repointed before the row goes, and the whole thing runs in
-- one function so a failure part-way leaves nothing half-merged.

create or replace function crm.merge_organisations(survivor uuid, loser uuid)
returns void
language plpgsql
as $$
declare
  snapshot jsonb;
begin
  if survivor = loser then
    raise exception 'Cannot merge an organisation into itself';
  end if;

  -- Snapshot before anything changes: merge_log.merged_snapshot is the only
  -- record of what the duplicate held, including fields not carried across.
  select to_jsonb(o) into snapshot from crm.organisations o where o.id = loser;
  if snapshot is null then
    raise exception 'Organisation % not found', loser;
  end if;
  if not exists (select 1 from crm.organisations where id = survivor) then
    raise exception 'Organisation % not found', survivor;
  end if;

  -- Fill only the survivor's blanks. Its own values always win, and its name
  -- is what makes it the survivor, so that is never touched.
  update crm.organisations s set
    industry       = coalesce(s.industry, l.industry),
    website        = coalesce(s.website, l.website),
    abn            = coalesce(s.abn, l.abn),
    account_number = coalesce(s.account_number, l.account_number),
    address        = coalesce(s.address, l.address),
    notes          = coalesce(s.notes, l.notes),
    is_client      = s.is_client or l.is_client,
    updated_at     = now()
  from crm.organisations l
  where s.id = survivor and l.id = loser;

  update crm.contacts   set organisation_id = survivor where organisation_id = loser;
  update crm.deals      set organisation_id = survivor where organisation_id = loser;
  update crm.activities set organisation_id = survivor where organisation_id = loser;

  -- A tag both organisations carry would collide with the partial unique index
  -- on (tag_id, organisation_id), so drop the duplicate's copy first and move
  -- only the tags the survivor is missing.
  delete from crm.taggings t
   where t.organisation_id = loser
     and exists (
       select 1 from crm.taggings s
        where s.organisation_id = survivor and s.tag_id = t.tag_id
     );
  update crm.taggings set organisation_id = survivor where organisation_id = loser;

  insert into crm.merge_log (entity_type, survivor_id, merged_id, merged_snapshot, merged_by)
  values ('organisation', survivor, loser, snapshot, auth.uid());

  delete from crm.organisations where id = loser;
end $$;

grant execute on function crm.merge_organisations(uuid, uuid) to authenticated;

-- merge_log was created in 001 but never had a policy, so it was unreadable
-- and unwritable through the API. The insert above happens inside a SECURITY
-- INVOKER function, so it needs one.
alter table crm.merge_log enable row level security;
drop policy if exists p_all on crm.merge_log;
create policy p_all on crm.merge_log for all to authenticated using (true) with check (true);
