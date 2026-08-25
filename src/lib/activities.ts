import { supabase } from '@/lib/supabase'
import type { ActivityRow } from '@/types/crm'

export const ACTIVITIES_PAGE_SIZE = 20

/** The seven values crm.activities.type is constrained to, in the order the
 * form offers them. */
export const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'site_visit', 'quote_sent', 'note', 'task'] as const

export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  site_visit: 'Site visit',
  quote_sent: 'Quote sent',
  note: 'Note',
  task: 'Task',
}

/** Types that crm.sync_last_contacted() treats as real contact — logging one
 * against a contact refreshes their last_contacted_at and clears the stale
 * flag. Notes and tasks deliberately don't count. */
const CONTACT_TYPES = new Set(['call', 'email', 'meeting', 'site_visit', 'quote_sent'])

export function countsAsContact(type: string): boolean {
  return CONTACT_TYPES.has(type)
}

export interface ActivityPage {
  rows: ActivityRow[]
  hasMore: boolean
}

interface ListActivitiesParams {
  organisationId?: string
  contactId?: string
  dealId?: string
  offset: number
}

export async function listActivities({
  organisationId,
  contactId,
  dealId,
  offset,
}: ListActivitiesParams): Promise<ActivityPage> {
  let query = supabase
    .from('activities')
    .select('*')
    .order('occurred_at', { ascending: false })
    .range(offset, offset + ACTIVITIES_PAGE_SIZE)

  if (organisationId) query = query.eq('organisation_id', organisationId)
  if (contactId) query = query.eq('contact_id', contactId)
  if (dealId) query = query.eq('deal_id', dealId)

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const hasMore = rows.length > ACTIVITIES_PAGE_SIZE
  return { rows: hasMore ? rows.slice(0, ACTIVITIES_PAGE_SIZE) : rows, hasMore }
}

export type ActivityFormValues = Pick<
  ActivityRow,
  'type' | 'subject' | 'notes' | 'occurred_at' | 'due_at' | 'deal_id' | 'contact_id' | 'organisation_id'
>

export async function createActivity(values: ActivityFormValues, createdBy: string | null): Promise<ActivityRow> {
  const { data, error } = await supabase
    .from('activities')
    .insert({ ...values, created_by: createdBy })
    .select('*')
    .single()

  if (error) throw error
  return data
}

/** Ticking a follow-up off is just stamping completed_at; clearing it reopens. */
export async function setActivityCompleted(id: string, completed: boolean): Promise<ActivityRow> {
  const { data, error } = await supabase
    .from('activities')
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export type OpenFollowUpRow = ActivityRow & {
  organisation_name: string | null
  contact_name: string | null
  deal_title: string | null
}

type RawFollowUpRow = ActivityRow & {
  organisations: { name: string } | null
  contacts: { first_name: string; last_name: string | null } | null
  deals: { title: string } | null
}

/**
 * Anything with a due date that hasn't been ticked off — tasks, but also a
 * follow-up hung off a call or a quote. Soonest first; overdue rows therefore
 * surface at the top.
 */
export async function listOpenFollowUps(limit = 8): Promise<OpenFollowUpRow[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*, organisations(name), contacts(first_name, last_name), deals(title)')
    .not('due_at', 'is', null)
    .is('completed_at', null)
    .order('due_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((row: RawFollowUpRow) => {
    const { organisations, contacts, deals, ...activity } = row
    return {
      ...activity,
      organisation_name: organisations?.name ?? null,
      contact_name: contacts ? [contacts.first_name, contacts.last_name].filter(Boolean).join(' ') : null,
      deal_title: deals?.title ?? null,
    }
  })
}
