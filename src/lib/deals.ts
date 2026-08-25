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

export type DealBoardRow = DealRow & {
  organisation_name: string
  organisation_website: string | null
  contact_name: string | null
}

const BOARD_SELECT = '*, organisations(name, website), contacts(first_name, last_name)'

type RawBoardRow = DealRow & {
  organisations: { name: string; website: string | null }
  contacts: { first_name: string; last_name: string | null } | null
}

function flattenBoardRow(row: RawBoardRow): DealBoardRow {
  const { organisations, contacts, ...deal } = row
  return {
    ...deal,
    organisation_name: organisations.name,
    organisation_website: organisations.website,
    contact_name: contacts ? fullName(contacts.first_name, contacts.last_name) : null,
  }
}

function fullName(first: string, last: string | null): string {
  return last ? `${first} ${last}` : first
}

export async function listDealsForBoard(): Promise<DealBoardRow[]> {
  const { data, error } = await supabase.from('deals').select(BOARD_SELECT).order('board_position', { ascending: true })

  if (error) throw error
  return (data ?? []).map(flattenBoardRow)
}

export async function getDeal(id: string): Promise<DealBoardRow | null> {
  const { data, error } = await supabase.from('deals').select(BOARD_SELECT).eq('id', id).maybeSingle()

  if (error) throw error
  return data ? flattenBoardRow(data) : null
}

export async function updateDealPosition(
  id: string,
  values: { stage_id: number; board_position: number },
): Promise<void> {
  const { error } = await supabase.from('deals').update(values).eq('id', id)
  if (error) throw error
}

// Fractional/"midpoint" indexing: slot a card between its new neighbours'
// board_position without renumbering the rest of the column. Mirrors the
// spacing the seed import used (1000 apart) so there's always room.
export function computeBoardPosition(columnDeals: DealBoardRow[], destIndex: number): number {
  const before = columnDeals[destIndex - 1]
  const after = columnDeals[destIndex]

  if (!before && !after) return 1000
  if (!before) return after.board_position / 2
  if (!after) return before.board_position + 1000
  return (before.board_position + after.board_position) / 2
}

/**
 * The end of a stage's column. Used when a deal changes stage somewhere that
 * isn't the board (the deal page), where there's no local copy of the
 * destination column to slot it into — without this the card keeps whatever
 * board_position it had in its old column and lands arbitrarily in the new one.
 */
export async function nextBoardPosition(stageId: number): Promise<number> {
  const { data, error } = await supabase
    .from('deals')
    .select('board_position')
    .eq('stage_id', stageId)
    .order('board_position', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data?.board_position ?? 0) + 1000
}

export type DealFormValues = Pick<
  DealRow,
  | 'title'
  | 'organisation_id'
  | 'primary_contact_id'
  | 'stage_id'
  | 'deal_type'
  | 'value_cents'
  | 'expected_close_date'
  | 'source'
  | 'notes'
  | 'probability_override'
  | 'lost_reason'
>

export async function createDeal(values: DealFormValues, boardPosition: number): Promise<DealBoardRow> {
  const { data, error } = await supabase
    .from('deals')
    .insert({ ...values, board_position: boardPosition })
    .select(BOARD_SELECT)
    .single()

  if (error) throw error
  return flattenBoardRow(data)
}

export async function updateDeal(
  id: string,
  values: DealFormValues & { board_position?: number },
): Promise<DealBoardRow> {
  const { data, error } = await supabase.from('deals').update(values).eq('id', id).select(BOARD_SELECT).single()

  if (error) throw error
  return flattenBoardRow(data)
}

// activities.deal_id is ON DELETE CASCADE, so a deal's logged activities go
// with it. That's why the caller confirms first.
export async function deleteDeal(id: string): Promise<void> {
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) throw error
}

// Moving a deal into a won/lost stage is a plain stage_id write — the
// `trg_deals_close_stamps` trigger in 001_initial_schema.sql sets (and clears)
// won_at/lost_at from the stage's is_won/is_lost, so the row has to be read
// back rather than patched optimistically.
export async function setDealStage(
  id: string,
  values: { stage_id: number; board_position: number; lost_reason?: string | null },
): Promise<DealBoardRow> {
  const { data, error } = await supabase.from('deals').update(values).eq('id', id).select(BOARD_SELECT).single()

  if (error) throw error
  return flattenBoardRow(data)
}

/** Records why a deal was lost without touching its stage — used when the
 * move already happened (a drag) and only the reason is outstanding. */
export async function setDealLostReason(id: string, reason: string | null): Promise<DealBoardRow> {
  const { data, error } = await supabase
    .from('deals')
    .update({ lost_reason: reason })
    .eq('id', id)
    .select(BOARD_SELECT)
    .single()

  if (error) throw error
  return flattenBoardRow(data)
}

// handoff_key isn't in the generated Database type yet (database.ts needs
// regenerating after `alter table crm.deals add column handoff_key uuid`),
// and postgrest-js's Update type actively rejects excess properties even on
// a separately-declared object, so a narrow, explicit cast is needed for
// just this one field rather than widening deals.Update speculatively. It's
// write-only: nothing reads it back today — it's stored purely for the
// future real StudioTime API call to use as an idempotency/correlation
// token.
export async function markDealHandedOff(id: string): Promise<{ handedOffAt: string }> {
  const handedOffAt = new Date().toISOString()
  const payload = { handed_off_at: handedOffAt, handoff_key: crypto.randomUUID() } as Pick<
    DealRow,
    'handed_off_at'
  >

  const { error } = await supabase.from('deals').update(payload).eq('id', id)
  if (error) throw error

  return { handedOffAt }
}

// ---------------------------------------------------------------- deals table

export const DEALS_PAGE_SIZE = 50

export type DealSortColumn = 'title' | 'expected_close_date' | 'value_cents' | 'created_at'

export interface ListDealsParams {
  search: string
  stageId: number | null
  dealType: string
  /** 'open' | 'won' | 'lost' | '' — resolved to stage ids by the caller. */
  wonStageIds: number[]
  lostStageIds: number[]
  status: string
  sortColumn: DealSortColumn
  ascending: boolean
  page: number
}

export interface ListDealsResult {
  rows: DealBoardRow[]
  total: number
}

// PostgREST's `or=(...)` treats `,` and `()` as syntax, so strip them from
// user input before interpolating — same guard as the contacts search.
function sanitizeForOrFilter(term: string): string {
  return term.replace(/[,()]/g, ' ').trim()
}

async function organisationIdsMatching(term: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('organisations')
    .select('id')
    .ilike('name', `%${term}%`)
    .limit(200)

  if (error) throw error
  return (data ?? []).map((row) => row.id)
}

export async function listDeals(params: ListDealsParams): Promise<ListDealsResult> {
  const { search, stageId, dealType, wonStageIds, lostStageIds, status, sortColumn, ascending, page } = params
  const from = page * DEALS_PAGE_SIZE
  const to = from + DEALS_PAGE_SIZE - 1

  let query = supabase.from('deals').select(BOARD_SELECT, { count: 'exact' })

  if (stageId !== null) query = query.eq('stage_id', stageId)
  if (dealType) query = query.eq('deal_type', dealType)

  // Status is a coarser filter than stage and derives from the stage flags,
  // so it's expressed as a stage-id set rather than a column of its own.
  if (status === 'won' && wonStageIds.length) query = query.in('stage_id', wonStageIds)
  if (status === 'lost' && lostStageIds.length) query = query.in('stage_id', lostStageIds)
  if (status === 'open') {
    const closed = [...wonStageIds, ...lostStageIds]
    if (closed.length) query = query.not('stage_id', 'in', `(${closed.join(',')})`)
  }

  const cleaned = sanitizeForOrFilter(search)
  if (cleaned) {
    // The organisation name lives on an embedded resource, and PostgREST
    // can't or() across the parent and an embed. Resolving matching orgs
    // first and folding their ids into the same or() keeps it one filter —
    // the same two-step listContacts uses for tags.
    const orgIds = await organisationIdsMatching(cleaned)
    const clauses = [`title.ilike.%${cleaned}%`, `source.ilike.%${cleaned}%`]
    if (orgIds.length) clauses.push(`organisation_id.in.(${orgIds.join(',')})`)
    query = query.or(clauses.join(','))
  }

  query = query.order(sortColumn, { ascending, nullsFirst: false }).range(from, to)

  const { data, error, count } = await query
  if (error) throw error
  return { rows: (data ?? []).map(flattenBoardRow), total: count ?? 0 }
}
