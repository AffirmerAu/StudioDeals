import { supabase } from '@/lib/supabase'
import type { OrganisationRow, OrganisationSummaryRow } from '@/types/crm'

export const ORGANISATIONS_PAGE_SIZE = 50

export type OrganisationSortColumn =
  | 'name'
  | 'industry'
  | 'contact_count'
  | 'open_deal_count'
  | 'won_value_cents'

export interface ListOrganisationsParams {
  search: string
  industry: string | null
  showAll: boolean
  sortColumn: OrganisationSortColumn
  ascending: boolean
  page: number
}

export interface ListOrganisationsResult {
  rows: OrganisationSummaryRow[]
  total: number
}

export async function listOrganisations(params: ListOrganisationsParams): Promise<ListOrganisationsResult> {
  const { search, industry, showAll, sortColumn, ascending, page } = params
  const from = page * ORGANISATIONS_PAGE_SIZE
  const to = from + ORGANISATIONS_PAGE_SIZE - 1

  let query = supabase.from('v_organisation_summary').select('*', { count: 'exact' })

  if (!showAll) query = query.eq('is_client', true)
  if (industry) query = query.eq('industry', industry)
  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)

  query = query.order(sortColumn, { ascending }).range(from, to)

  const { data, error, count } = await query
  if (error) throw error

  return { rows: data ?? [], total: count ?? 0 }
}

export async function listIndustries(): Promise<string[]> {
  const { data, error } = await supabase
    .from('organisations')
    .select('industry')
    .not('industry', 'is', null)

  if (error) throw error
  const unique = new Set((data ?? []).map((row) => row.industry).filter((v): v is string => !!v))
  return Array.from(unique).sort((a, b) => a.localeCompare(b))
}

export async function getOrganisation(id: string): Promise<OrganisationRow | null> {
  const { data, error } = await supabase.from('organisations').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export interface OrganisationOption {
  id: string
  name: string
  industry: string | null
}

export async function searchOrganisations(query: string, limit = 20): Promise<OrganisationOption[]> {
  let request = supabase.from('organisations').select('id, name, industry').order('name', { ascending: true })
  if (query.trim()) request = request.ilike('name', `%${query.trim()}%`)
  const { data, error } = await request.limit(limit)
  if (error) throw error
  return data ?? []
}

export type OrganisationFormValues = Pick<
  OrganisationRow,
  'name' | 'industry' | 'website' | 'abn' | 'account_number' | 'address' | 'is_client' | 'notes'
>

export async function createOrganisation(values: OrganisationFormValues): Promise<OrganisationRow> {
  const { data, error } = await supabase.from('organisations').insert(values).select('*').single()
  if (error) throw error
  return data
}

export async function updateOrganisation(id: string, values: OrganisationFormValues): Promise<OrganisationRow> {
  const { data, error } = await supabase.from('organisations').update(values).eq('id', id).select('*').single()
  if (error) throw error
  return data
}
