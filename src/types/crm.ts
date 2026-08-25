/**
 * Convenience row aliases derived from the generated `Database` type.
 * Kept separate from database.ts so that file stays a clean, disposable
 * drop-in replacement on every `supabase gen types` regeneration.
 */
import type { Database } from '@/types/database'

export type OrganisationRow = Database['crm']['Tables']['organisations']['Row']
export type ContactRow = Database['crm']['Tables']['contacts']['Row']
export type DealRow = Database['crm']['Tables']['deals']['Row']
export type ActivityRow = Database['crm']['Tables']['activities']['Row']
export type PipelineStageRow = Database['crm']['Tables']['pipeline_stages']['Row']
export type TagRow = Database['crm']['Tables']['tags']['Row']

// `supabase gen types` marks every view column nullable regardless of the
// underlying table's constraints — Postgres view introspection doesn't
// propagate NOT NULL the way it does for base tables, and there's no SQL
// fix for it. These narrow only the columns we can actually prove are
// non-null from the view's own definition (primary keys, and aggregates
// that are always coalesced/counted) — never columns that are genuinely
// optional (organisation_name, last_contacted_at, etc.). The narrowing is
// applied once, at the query boundary in lib/organisations.ts and
// lib/contacts.ts, rather than scattered as assertions through components.
type RawOrganisationSummaryRow = Database['crm']['Views']['v_organisation_summary']['Row']
export type OrganisationSummaryRow = Omit<
  RawOrganisationSummaryRow,
  'id' | 'name' | 'contact_count' | 'open_deal_count' | 'won_value_cents'
> & {
  id: string
  name: string
  contact_count: number
  open_deal_count: number
  won_value_cents: number
}

type RawContactListRow = Database['crm']['Views']['v_contacts_list']['Row']
export type ContactListRow = Omit<RawContactListRow, 'id' | 'first_name' | 'is_primary' | 'is_stale'> & {
  id: string
  first_name: string
  is_primary: boolean
  // (v.id is not null) in the view definition — a boolean expression, never
  // actually null, unlike every other view column.
  is_stale: boolean
}

// These three views all use inner joins and GROUP BY/boolean-expression
// columns only (no left joins introducing genuine optionality, unlike the
// two views above) — per their definitions in 001_initial_schema.sql every
// column is guaranteed non-null for any row the view actually returns, so
// the whole row narrows cleanly rather than picking individual columns.
type RawPipelineForecastRow = Database['crm']['Views']['v_pipeline_forecast']['Row']
export type PipelineForecastRow = {
  [K in keyof RawPipelineForecastRow]: NonNullable<RawPipelineForecastRow[K]>
}

type RawDealsNeedingAttentionRow = Database['crm']['Views']['v_deals_needing_attention']['Row']
export type DealsNeedingAttentionRow = {
  [K in keyof RawDealsNeedingAttentionRow]: NonNullable<RawDealsNeedingAttentionRow[K]>
}

type RawPendingHandoffRow = Database['crm']['Views']['v_pending_handoff']['Row']
export type PendingHandoffRow = {
  [K in keyof RawPendingHandoffRow]: NonNullable<RawPendingHandoffRow[K]>
}
