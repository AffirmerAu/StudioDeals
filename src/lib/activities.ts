import { supabase } from '@/lib/supabase'
import type { ActivityRow } from '@/types/database'

export const ACTIVITIES_PAGE_SIZE = 20

export interface ActivityPage {
  rows: ActivityRow[]
  hasMore: boolean
}

interface ListActivitiesParams {
  organisationId?: string
  contactId?: string
  offset: number
}

export async function listActivities({ organisationId, contactId, offset }: ListActivitiesParams): Promise<ActivityPage> {
  let query = supabase
    .from('activities')
    .select('*')
    .order('occurred_at', { ascending: false })
    .range(offset, offset + ACTIVITIES_PAGE_SIZE)

  if (organisationId) query = query.eq('organisation_id', organisationId)
  if (contactId) query = query.eq('contact_id', contactId)

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const hasMore = rows.length > ACTIVITIES_PAGE_SIZE
  return { rows: hasMore ? rows.slice(0, ACTIVITIES_PAGE_SIZE) : rows, hasMore }
}
