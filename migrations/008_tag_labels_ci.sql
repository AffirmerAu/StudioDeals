-- Make tag labels unique case-insensitively, so the app can offer to create a
-- tag without letting "Safety", "safety" and "SAFETY" accumulate as three
-- separate tags.
--
-- crm.tags already has `label text not null unique`, but that is
-- case-sensitive. The app matches case-insensitively before creating, which
-- covers the ordinary path; this index is what makes it true rather than
-- merely likely — two people tagging at once would otherwise both pass the
-- check and both insert.
--
-- There is no merge tool for tags, deliberately: with this index in place the
-- duplicates cannot be created in the first place, which is the cheaper half
-- of the problem to solve.

-- The index cannot be created if the imported data already contains a
-- collision, and a bare index failure names only the first pair it hits. This
-- names all of them, with what to do about it.
do $$
declare
  collisions text;
begin
  select string_agg(labels, '; ' order by labels)
    into collisions
    from (
      select string_agg(label, ' / ' order by label) as labels
        from crm.tags
       group by lower(label)
      having count(*) > 1
    ) duplicates;

  if collisions is not null then
    raise exception
      E'Tags differing only in case already exist: %.\n'
      'Pick the spelling to keep for each, then for every other one:\n'
      '  update crm.taggings set tag_id = <keep> where tag_id = <drop>\n'
      '    and not exists (select 1 from crm.taggings t\n'
      '                     where t.tag_id = <keep>\n'
      '                       and t.organisation_id is not distinct from crm.taggings.organisation_id\n'
      '                       and t.contact_id is not distinct from crm.taggings.contact_id);\n'
      '  delete from crm.taggings where tag_id = <drop>;\n'
      '  delete from crm.tags where id = <drop>;\n'
      'Then re-run this migration.',
      collisions;
  end if;
end $$;

create unique index if not exists tags_label_lower_key on crm.tags (lower(label));
