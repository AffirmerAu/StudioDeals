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

/** The contact is embedded so the timeline can name who an activity was with
 * — needed on an organisation's timeline, where rows span several people, and
 * to prefill the picker when editing. */
export type TimelineActivityRow = ActivityRow & { contact_name: string | null }

const TIMELINE_SELECT = '*, contacts(first_name, last_name)'

type RawTimelineRow = ActivityRow & {
  contacts: { first_name: string; last_name: string | null } | null
}

function flattenTimelineRow(row: RawTimelineRow): TimelineActivityRow {
  const { contacts, ...activity } = row
  return {
    ...activity,
    contact_name: contacts ? [contacts.first_name, contacts.last_name].filter(Boolean).join(' ') : null,
  }
}

export interface ActivityPage {
  rows: TimelineActivityRow[]
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
    .select(TIMELINE_SELECT)
    // An open task is an intention, not something that happened, so it is kept
    // out of the history and lives in the tasks panel instead. Completing one
    // moves its occurred_at to the moment it was done (see
    // setActivityCompleted), which is where it then belongs on the timeline.
    .or('type.neq.task,completed_at.not.is.null')
    .order('occurred_at', { ascending: false })
    .range(offset, offset + ACTIVITIES_PAGE_SIZE)

  if (organisationId) query = query.eq('organisation_id', organisationId)
  if (contactId) query = query.eq('contact_id', contactId)
  if (dealId) query = query.eq('deal_id', dealId)

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []).map(flattenTimelineRow)
  const hasMore = rows.length > ACTIVITIES_PAGE_SIZE
  return { rows: hasMore ? rows.slice(0, ACTIVITIES_PAGE_SIZE) : rows, hasMore }
}

export type ActivityFormValues = Pick<
  ActivityRow,
  'type' | 'subject' | 'notes' | 'occurred_at' | 'due_at' | 'deal_id' | 'contact_id' | 'organisation_id'
>

export async function createActivity(
  values: ActivityFormValues,
  createdBy: string | null,
): Promise<TimelineActivityRow> {
  const { data, error } = await supabase
    .from('activities')
    .insert({ ...values, created_by: createdBy })
    .select(TIMELINE_SELECT)
    .single()

  if (error) throw error
  return flattenTimelineRow(data)
}

/** created_by is deliberately left alone — it records who logged the activity,
 * not who last corrected it. */
export async function updateActivity(id: string, values: ActivityFormValues): Promise<TimelineActivityRow> {
  const { data, error } = await supabase
    .from('activities')
    .update(values)
    .eq('id', id)
    .select(TIMELINE_SELECT)
    .single()

  if (error) throw error
  return flattenTimelineRow(data)
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) throw error
}

/**
 * Ticking a follow-up off is just stamping completed_at; clearing it reopens.
 *
 * A task also has its occurred_at moved to now. A task's occurred_at is a
 * placeholder while it is open — it is set at creation because the column is
 * NOT NULL, and the task is hidden from the timeline until it is done — so
 * completing one is the first moment it means anything. When it was raised is
 * still in created_at.
 */
export async function setActivityCompleted(
  id: string,
  completed: boolean,
  type?: string,
): Promise<TimelineActivityRow> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('activities')
    .update({
      completed_at: completed ? now : null,
      ...(completed && type === 'task' ? { occurred_at: now } : {}),
    })
    .eq('id', id)
    .select(TIMELINE_SELECT)
    .single()

  if (error) throw error
  return flattenTimelineRow(data)
}

// ------------------------------------------------------------------- tasks

/**
 * Everything outstanding on a record: standalone tasks, and follow-ups hung
 * off a call or a quote. Both are work owed, and the dashboard has always
 * treated them the same way. Soonest first, so overdue leads.
 */
export async function listOpenTasksFor(dealId: string): Promise<TimelineActivityRow[]> {
  const { data, error } = await supabase
    .from('activities')
    .select(TIMELINE_SELECT)
    .eq('deal_id', dealId)
    .not('due_at', 'is', null)
    .is('completed_at', null)
    .order('due_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(flattenTimelineRow)
}

export interface TaskDraft {
  subject: string
  dueAt: string
  notes: string | null
  dealId: string
  organisationId: string | null
  contactId: string | null
}

/**
 * A task is an activity with type 'task' and a due date. occurred_at is set to
 * now only because the column is NOT NULL — it is not read while the task is
 * open, and completing the task overwrites it.
 */
export async function createTask(draft: TaskDraft, createdBy: string | null): Promise<TimelineActivityRow> {
  return createActivity(
    {
      type: 'task',
      subject: draft.subject.trim() || null,
      notes: draft.notes?.trim() || null,
      occurred_at: new Date().toISOString(),
      due_at: draft.dueAt,
      deal_id: draft.dealId,
      organisation_id: draft.organisationId,
      contact_id: draft.contactId,
    },
    createdBy,
  )
}

export function isOverdue(dueAt: string | null, now = new Date()): boolean {
  return dueAt !== null && new Date(dueAt) < now
}

export const TASK_FILTERS = ['open', 'overdue', 'today', 'week', 'done'] as const
export type TaskFilter = (typeof TASK_FILTERS)[number]

export const TASK_FILTER_LABEL: Record<TaskFilter, string> = {
  open: 'All open',
  overdue: 'Overdue',
  today: 'Due today',
  week: 'Next 7 days',
  done: 'Recently done',
}

/** End of the local day, as an instant. Due "today" means by tonight, in the
 * timezone the person is standing in, not UTC. */
function endOfToday(now = new Date()): string {
  const d = new Date(now)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function inDays(days: number, now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export interface TaskListResult {
  rows: OpenFollowUpRow[]
  total: number
}

/**
 * Everything with a due date, across deals, contacts and organisations —
 * standalone tasks and follow-ups hung off a call or a quote alike.
 */
export async function listTasks(filter: TaskFilter, limit = 200): Promise<TaskListResult> {
  const now = new Date()
  let query = supabase
    .from('activities')
    .select('*, organisations(name), contacts(first_name, last_name), deals(title)', { count: 'exact' })
    .not('due_at', 'is', null)

  if (filter === 'done') {
    query = query.not('completed_at', 'is', null).order('completed_at', { ascending: false })
  } else {
    query = query.is('completed_at', null).order('due_at', { ascending: true })
    if (filter === 'overdue') query = query.lt('due_at', now.toISOString())
    if (filter === 'today') query = query.lte('due_at', endOfToday(now))
    if (filter === 'week') query = query.lte('due_at', inDays(7, now))
  }

  const { data, error, count } = await query.limit(limit)
  if (error) throw error

  return { rows: (data ?? []).map(flattenFollowUpRow), total: count ?? 0 }
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

function flattenFollowUpRow(row: RawFollowUpRow): OpenFollowUpRow {
  const { organisations, contacts, deals, ...activity } = row
  return {
    ...activity,
    organisation_name: organisations?.name ?? null,
    contact_name: contacts ? [contacts.first_name, contacts.last_name].filter(Boolean).join(' ') : null,
    deal_title: deals?.title ?? null,
  }
}

/**
 * Anything with a due date that hasn't been ticked off — tasks, but also a
 * follow-up hung off a call or a quote. Soonest first; overdue rows therefore
 * surface at the top.
 */
export async function listOpenFollowUps(limit = 8): Promise<{ rows: OpenFollowUpRow[]; total: number }> {
  const { data, error, count } = await supabase
    .from('activities')
    .select('*, organisations(name), contacts(first_name, last_name), deals(title)', { count: 'exact' })
    .not('due_at', 'is', null)
    .is('completed_at', null)
    .order('due_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  const rows = (data ?? []).map(flattenFollowUpRow)

  // The count matters more than it used to: now that tasks are easy to raise,
  // the list will routinely exceed the limit, and silently showing the first
  // eight of thirty is how a reminder stops being one.
  return { rows, total: count ?? rows.length }
}
