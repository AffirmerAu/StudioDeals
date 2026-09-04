# StudioDeals

Affirmer's CRM. Deals, contacts, and pipeline. Nothing leaves this
application: there is no outbound integration, and no monetary value is sent
anywhere.

The `deals` table still carries `handed_off_at`, `handoff_key` and
`studiotime_project_id`, and `crm.v_pending_handoff` still exists, from a
StudioTime handoff that was never built. Nothing reads or writes them today.

## Setup

    npm install
    cp .env.example .env.local   # then fill in the two values
    npm run dev

## Stack

React 19 · TypeScript · Vite 8 · Tailwind 4 · Supabase · Cloudflare Pages
Kanban drag-and-drop via `@dnd-kit`. Charts via Recharts.

## Notes

- All tables live in the `crm` schema, not `public`. The Supabase client
  is configured with `db: { schema: 'crm' }`.
- Pipeline stages come from `crm.pipeline_stages`. Never hardcode them.
- Money is stored as integer cents (`value_cents`). Format on display only.
- Regenerate `src/types/database.ts` from the Supabase dashboard after
  every schema change.
- Anon key only in the frontend. Elevated operations belong in edge functions.

## Migrations

Numbered SQL in `/migrations`, run by pasting into the Supabase SQL Editor.

## Gmail add-on

`/gmail-addon` is a Google Workspace add-on that shows a sender's StudioDeals
record in the Gmail sidebar. Apps Script, pushed with `clasp`, talking to the
same Supabase project with the same anon key and the user's own JWT — no
second backend. See `gmail-addon/README.md`.
