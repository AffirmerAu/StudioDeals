-- ============================================================================
-- StudioDeals — 010: record deals.handoff_key in the migrations
-- Safe to re-run. On the live database this is a no-op.
-- ============================================================================

-- Found by diffing src/types/database.ts — generated from live — against a
-- database rebuilt from 001 through 009. Every other table and view matched
-- column for column; deals did not. handoff_key exists live and no migration
-- creates it, so it was added by hand at some point and the files stopped
-- describing the database.
--
-- Nothing reads or writes it today: it was an idempotency token for a
-- StudioTime API call that was never built, and the handoff came out of the
-- app entirely. It is recorded here so a rebuild from these files produces the
-- schema that actually exists, rather than one that is quietly a column short.
--
-- ⚠️ The column's live type could not be observed from the build side — the
-- generated types map both `text` and `uuid` to `string`. `text` is declared
-- here because it accepts everything the app ever wrote to it (a UUID string
-- from crypto.randomUUID). If live is `uuid`, change this line to match rather
-- than altering live: `if not exists` means this file has never touched it.
alter table crm.deals
  add column if not exists handoff_key text;
