/**
 * Hand-written to mirror `crm` in migrations/001_initial_schema.sql and
 * migrations/003_phase2_views.sql.
 *
 * Prefer replacing this with the generated file when Supabase CLI access is
 * available (Supabase dashboard -> Integrations -> Data API -> TypeScript).
 * Regenerate after every schema change — this file is not auto-synced.
 */

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type DealType = 'production' | 'prestarter' | 'retainer' | 'other'
export type ActivityType = 'call' | 'email' | 'meeting' | 'site_visit' | 'quote_sent' | 'note' | 'task'
export type TagKind = 'label' | 'source' | 'industry' | 'event'

// `type` object literals (not `interface`) deliberately — postgrest-js's
// generics constrain Row/Insert/Update to `Record<string, unknown>`, and
// only object-literal type aliases pick up the implicit index signature
// that satisfies that constraint. An `interface` here silently makes every
// query resolve to `never`.
export type OrganisationRow = {
  id: string
  name: string
  industry: string | null
  website: string | null
  abn: string | null
  account_number: string | null
  address: string | null
  is_client: boolean
  notes: string | null
  legacy_capsule_id: string | null
  created_at: string
  updated_at: string
}

export type ContactRow = {
  id: string
  organisation_id: string | null
  first_name: string
  last_name: string | null
  role: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  last_contacted_at: string | null
  notes: string | null
  legacy_capsule_id: string | null
  created_at: string
  updated_at: string
}

export type DealRow = {
  id: string
  title: string
  organisation_id: string
  primary_contact_id: string | null
  stage_id: number
  deal_type: DealType
  value_cents: number
  currency: string
  expected_close_date: string | null
  probability_override: number | null
  board_position: number
  source: string | null
  won_at: string | null
  lost_at: string | null
  lost_reason: string | null
  handed_off_at: string | null
  studiotime_project_id: string | null
  notes: string | null
  legacy_capsule_id: string | null
  created_at: string
  updated_at: string
}

export type ActivityRow = {
  id: string
  deal_id: string | null
  contact_id: string | null
  organisation_id: string | null
  type: ActivityType
  subject: string | null
  notes: string | null
  occurred_at: string
  due_at: string | null
  completed_at: string | null
  created_by: string | null
  created_at: string
}

export type PipelineStageRow = {
  id: number
  key: string
  label: string
  position: number
  probability: number
  is_won: boolean
  is_lost: boolean
}

export type TagRow = {
  id: number
  label: string
  kind: TagKind
}

export type TaggingRow = {
  id: number
  tag_id: number
  organisation_id: string | null
  contact_id: string | null
}

export type OrganisationSummaryRow = OrganisationRow & {
  contact_count: number
  open_deal_count: number
  won_value_cents: number
}

export type ContactListRow = ContactRow & {
  organisation_name: string | null
  is_stale: boolean
}

export type StaleContactRow = ContactRow & {
  organisation_name: string | null
  since_contact: string | null
}

type TableDef<Row, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type ViewDef<Row> = { Row: Row; Relationships: [] }

// Columns that are nullable, defaulted, or generated stay optional on
// Insert — mirrors what `supabase gen types` would produce.
type OrganisationInsert = Pick<OrganisationRow, 'name'> &
  Partial<
    Pick<
      OrganisationRow,
      | 'id'
      | 'industry'
      | 'website'
      | 'abn'
      | 'account_number'
      | 'address'
      | 'is_client'
      | 'notes'
      | 'legacy_capsule_id'
      | 'created_at'
      | 'updated_at'
    >
  >

type ContactInsert = Pick<ContactRow, 'first_name'> &
  Partial<
    Pick<
      ContactRow,
      | 'id'
      | 'organisation_id'
      | 'last_name'
      | 'role'
      | 'email'
      | 'phone'
      | 'is_primary'
      | 'last_contacted_at'
      | 'notes'
      | 'legacy_capsule_id'
      | 'created_at'
      | 'updated_at'
    >
  >

type DealInsert = Pick<DealRow, 'title' | 'organisation_id'> &
  Partial<
    Pick<
      DealRow,
      | 'id'
      | 'primary_contact_id'
      | 'stage_id'
      | 'deal_type'
      | 'value_cents'
      | 'currency'
      | 'expected_close_date'
      | 'probability_override'
      | 'board_position'
      | 'source'
      | 'won_at'
      | 'lost_at'
      | 'lost_reason'
      | 'handed_off_at'
      | 'studiotime_project_id'
      | 'notes'
      | 'legacy_capsule_id'
      | 'created_at'
      | 'updated_at'
    >
  >

type ActivityInsert = Pick<ActivityRow, 'type'> &
  Partial<
    Pick<
      ActivityRow,
      | 'id'
      | 'deal_id'
      | 'contact_id'
      | 'organisation_id'
      | 'subject'
      | 'notes'
      | 'occurred_at'
      | 'due_at'
      | 'completed_at'
      | 'created_by'
      | 'created_at'
    >
  >

type TagInsert = Pick<TagRow, 'label'> & Partial<Pick<TagRow, 'id' | 'kind'>>
type TaggingInsert = Pick<TaggingRow, 'tag_id'> & Partial<Pick<TaggingRow, 'id' | 'organisation_id' | 'contact_id'>>

export type Database = {
  crm: {
    Tables: {
      organisations: TableDef<OrganisationRow, OrganisationInsert>
      contacts: TableDef<ContactRow, ContactInsert>
      deals: TableDef<DealRow, DealInsert>
      activities: TableDef<ActivityRow, ActivityInsert>
      pipeline_stages: TableDef<PipelineStageRow, PipelineStageRow>
      tags: TableDef<TagRow, TagInsert>
      taggings: TableDef<TaggingRow, TaggingInsert>
    }
    Views: {
      v_organisation_summary: ViewDef<OrganisationSummaryRow>
      v_contacts_list: ViewDef<ContactListRow>
      v_stale_contacts: ViewDef<StaleContactRow>
    }
    Functions: Record<string, { Args: Record<string, Json>; Returns: Json }>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
