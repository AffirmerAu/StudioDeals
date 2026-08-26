Numbered migrations, applied by pasting into the Supabase SQL Editor.

001_initial_schema.sql        — schema, triggers, views, RLS, grants
002_capsule_import.sql        — staging tables and merge (Phase 0.5, already applied)
003_phase2_views.sql          — v_organisation_summary, v_contacts_list (Phase 2)
004_targets.sql               — crm.targets, the monthly dashboard targets
005_last_contacted_resync.sql — recompute contacts.last_contacted_at, with an
                                imported baseline kept as a floor
006_merge_organisations.sql   — crm.merge_organisations, and merge_log's first
                                RLS policy
007_merge_contacts.sql        — v_possible_duplicate_contacts,
                                crm.merge_contacts, v_merge_log

Each is safe to re-run: everything is `create or replace`, `add column if not
exists`, or an update whose predicate excludes rows it has already touched.

⚠️ 003 has drifted — its v_contacts_list / v_organisation_summary definitions
no longer match what is live. 004 onwards are accurate.

After applying anything that adds a table, view or function, regenerate the
TypeScript types so the app can stop casting around them:

    supabase gen types typescript --schema crm > src/types/database.ts
