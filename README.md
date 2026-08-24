# StudioDeals

Affirmer's CRM. Deals, contacts, and pipeline. Hands off won deals to
StudioTime as a project name and client name only — no monetary value
ever leaves this application.

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
