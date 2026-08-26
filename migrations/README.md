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

002 was the Capsule import (staging tables and merge, Phase 0.5). It was
applied to the live database but the file was never committed here, so a
rebuild from these files gives an empty CRM rather than the imported one.

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
It has been corrected against src/types/database.ts, which is the real
introspected shape of the live views.

The same can happen again. After applying anything that adds or alters a
table, view or function, regenerate the types — both so the app can stop
casting around the change, and so there is a checkable record of what is
actually live:

    supabase gen types typescript --schema crm > src/types/database.ts
