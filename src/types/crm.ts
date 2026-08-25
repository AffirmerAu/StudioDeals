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

export type OrganisationSummaryRow = Database['crm']['Views']['v_organisation_summary']['Row']
export type ContactListRow = Database['crm']['Views']['v_contacts_list']['Row']
