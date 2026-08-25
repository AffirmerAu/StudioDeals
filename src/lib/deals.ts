import { supabase } from '@/lib/supabase'
import type { DealRow } from '@/types/crm'

export async function listDealsForOrganisation(organisationId: string): Promise<DealRow[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('expected_close_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return data ?? []
}

export async function listDealsForContact(contactId: string): Promise<DealRow[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('primary_contact_id', contactId)
    .order('expected_close_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return data ?? []
}
