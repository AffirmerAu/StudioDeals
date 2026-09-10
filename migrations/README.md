Numbered migrations, applied by pasting into the Supabase SQL Editor.

001_initial_schema.sql        — schema, triggers, views, RLS, grants
003_phase2_views.sql          — v_organisation_summary, v_contacts_list
004_targets.sql               — crm.targets, the monthly dashboard targets
005_last_contacted_resync.sql — recompute contacts.last_contacted_at, with an
                                imported baseline kept as a floor
006_merge_organisations.sql   — crm.merge_organisations, and merge_log's first
                                RLS policy
007_merge_contacts.sql        — v_possible_duplicate_contacts,
                                crm.merge_contacts, v_merge_log
008_tag_labels_ci.sql         — case-insensitive uniqueness on tag labels
009_gmail_messages.sql        — gmail_message_id and gmail_thread_id on
                                crm.activities, and crm.find_contacts_by_email
010_deals_handoff_key.sql     — records deals.handoff_key, which existed live
                                but in no migration

002 was the Capsule import (staging tables and merge, Phase 0.5). It was
applied to the live database but the file was never committed here, so a
rebuild from these files gives an empty CRM rather than the imported one.

The Capsule refresh — a second import of updated Capsule data — was built and
tested as 009, then dropped before it was ever run. It survives at commit
78c02ee. If it is ever taken back off the shelf it needs renumbering to 010,
because 009 is the Gmail one now.

Re-running
----------
003 onwards are safe to re-run: everything is `create or replace`, `create
table if not exists`, `drop policy if exists`, or an update whose predicate
excludes the rows it has already touched.

001 is one-shot. Its `create table` statements have no `if not exists`, so a
second run fails at the first table. Worth knowing why that is the right
behaviour rather than a gap: 001 defines `crm.v_stale_contacts` as
`select c.*`, and Postgres expands the `*` when the view is created. 005 later
adds `contacts.last_contacted_baseline`, so re-running just that one statement
today fails with `cannot change name of view column "organisation_name" to
"last_contacted_baseline"`. Run in order from scratch, the sequence is
correct — the view is created before the column exists, which is exactly why
v_stale_contacts does not carry last_contacted_baseline live.

Keeping these files honest
--------------------------
003 was originally written as a proposal and the views were then built
differently by hand, so for a long time it did not describe what was live.
It has since been reconciled against the live definitions.

Reconciling it turned up a bug: the live v_organisation_summary joined
contacts and deals flat off the same organisation, so each deal's value was
summed once per contact and won_value_cents — shown and sortable on the
organisations list — was multiplied by the contact count. 003 now aggregates
each side separately, and re-running it replaces the view in place and
corrects the figures.

The same can happen again. After applying anything that adds or alters a
table, view or function, regenerate the types — both so the app can stop
casting around the change, and so there is a checkable record of what is
actually live:

    supabase gen types typescript --schema crm > src/types/database.ts

But do not trust the generated types for a view's column ORDER or for the
width of a numeric column: they are alphabetised, and bigint and numeric both
come back as `number`. `create or replace view` matches columns by position
and type, so getting either wrong fails with "cannot change name of view
column". The live shape comes from the database itself:

    select ordinal_position, column_name, data_type
    from information_schema.columns
    where table_schema = 'crm' and table_name = 'v_contacts_list'
    order by ordinal_position;

Checking these files against the database
-----------------------------------------
src/types/database.ts is generated from the live database, so it can be used
to check the migrations without any access to live: build a database from
these files, list every column of every relation in `crm` from the catalogue,
and compare the two sets.

Done that way, 17 of 18 relations matched column for column and `deals` did
not — `handoff_key` was in the generated types and in no migration. That is
what 010 records. The same check now comes back clean, which is the strongest
statement available from the build side: the files and the live schema agree
about every table, view, column and function in `crm`.

Worth re-running whenever database.ts is regenerated. It is the cheap version
of the problem that produced the 003 reconciliation below.


Regenerating src/types/database.ts
-----------------------------------
Every schema change ends here. The file is the app's record of what the
database looks like, and the project's rule is that no code is written against
a table until the generated types confirm its shape.

Run it in **Git Bash**, not PowerShell. PowerShell's `>` writes UTF-16 and
converts line endings to CRLF, which rewrites all 900-odd lines and buries the
real change in noise. Git Bash passes bytes through unchanged. Right-click the
repository folder and choose "Git Bash Here".

    cd ~/script/StudioDeals
    git checkout main
    git pull

    npx supabase@latest login

`login` opens a browser and prints a token back. If it fails with a reauth
error, `npx supabase@latest logout` first — Workspace accounts expire the
grant periodically. A personal access token from
https://supabase.com/dashboard/account/tokens also works, exported as
SUPABASE_ACCESS_TOKEN; that token is a credential, so never paste it into a
file in this repository.

    npx supabase@latest gen types typescript \
      --project-id vfmjrcpemlvseczqvrsw \
      --schema crm \
      > src/types/database.ts

`--schema crm` is not optional. Everything lives in `crm`, and without the
flag the generator emits `public` instead and breaks every import in the app.

Then check it before committing:

    grep -c "gmail_message_id" src/types/database.ts   # expect 3 or more
    git diff --stat src/types/database.ts              # expect a handful of lines
    npm run build

A diff of ~900 changed lines means the encoding got mangled — you were in
PowerShell. Zero occurrences of a column you know exists means it generated
against the wrong schema or a stale snapshot.

Finally, run the drift check above. Regenerating is when the types and the
migrations are most likely to disagree, and it is the only moment the
disagreement is cheap to find.

