import { supabase } from '@/lib/supabase'
import { contactIdsForTag } from '@/lib/tags'
import type { ContactListRow, ContactRow } from '@/types/crm'

export const CONTACTS_PAGE_SIZE = 50

export type ContactSortColumn = 'first_name' | 'organisation_name' | 'last_contacted_at'

export interface ListContactsParams {
  search: string
  organisationId: string | null
  tagId: number | null
  sortColumn: ContactSortColumn
  ascending: boolean
  page: number
}

export interface ListContactsResult {
  rows: ContactListRow[]
  total: number
}

// PostgREST's `or=(...)` filter string treats `,` and `()` as syntax, so
// strip them from user input before interpolating.
function sanitizeForOrFilter(term: string): string {
  return term.replace(/[,()]/g, ' ').trim()
}

export async function listContacts(params: ListContactsParams): Promise<ListContactsResult> {
  const { search, organisationId, tagId, sortColumn, ascending, page } = params
  const from = page * CONTACTS_PAGE_SIZE
  const to = from + CONTACTS_PAGE_SIZE - 1

  let query = supabase.from('v_contacts_list').select('*', { count: 'exact' })

  if (organisationId) query = query.eq('organisation_id', organisationId)

  if (tagId !== null) {
    const contactIds = await contactIdsForTag(tagId)
    if (contactIds.length === 0) return { rows: [], total: 0 }
    query = query.in('id', contactIds)
  }

  const cleaned = sanitizeForOrFilter(search)
  if (cleaned) {
    query = query.or(
      `first_name.ilike.%${cleaned}%,last_name.ilike.%${cleaned}%,email.ilike.%${cleaned}%,organisation_name.ilike.%${cleaned}%`,
    )
  }

  query = query.order(sortColumn, { ascending }).range(from, to)

  const { data, error, count } = await query
  if (error) throw error
  // id/first_name/is_primary/is_stale are guaranteed non-null even though
  // the generated type marks every view column nullable — see the comment
  // on ContactListRow in types/crm.ts.
  return { rows: (data ?? []) as ContactListRow[], total: count ?? 0 }
}

export interface ContactOption {
  id: string
  first_name: string
  last_name: string | null
}

export async function searchContactsForOrganisation(
  organisationId: string,
  query: string,
  limit = 20,
): Promise<ContactOption[]> {
  let request = supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .eq('organisation_id', organisationId)
    .order('first_name', { ascending: true })

  if (query.trim()) {
    const cleaned = sanitizeForOrFilter(query)
    request = request.or(`first_name.ilike.%${cleaned}%,last_name.ilike.%${cleaned}%`)
  }

  const { data, error } = await request.limit(limit)
  if (error) throw error
  return data ?? []
}

export async function listContactsForOrganisation(organisationId: string): Promise<ContactRow[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('first_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getContact(id: string): Promise<ContactListRow | null> {
  const { data, error } = await supabase.from('v_contacts_list').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  // Same narrowing as listContacts above — a matched row always has a real
  // id/first_name/is_primary.
  return data as ContactListRow | null
}

export type ContactFormValues = Pick<
  ContactRow,
  'first_name' | 'last_name' | 'role' | 'email' | 'phone' | 'organisation_id' | 'is_primary' | 'notes'
>

export async function createContact(values: ContactFormValues): Promise<ContactRow> {
  const { data, error } = await supabase.from('contacts').insert(values).select('*').single()
  if (error) throw error
  return data
}

export async function updateContact(id: string, values: ContactFormValues): Promise<ContactRow> {
  const { data, error } = await supabase.from('contacts').update(values).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) throw error
}
