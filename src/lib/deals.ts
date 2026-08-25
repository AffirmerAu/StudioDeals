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

export type DealBoardRow = DealRow & { organisation_name: string; contact_name: string | null }

const BOARD_SELECT = '*, organisations(name), contacts(first_name, last_name)'

type RawBoardRow = DealRow & {
  organisations: { name: string }
  contacts: { first_name: string; last_name: string | null } | null
}

function flattenBoardRow(row: RawBoardRow): DealBoardRow {
  const { organisations, contacts, ...deal } = row
  return {
    ...deal,
    organisation_name: organisations.name,
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

export async function updateDeal(id: string, values: DealFormValues): Promise<DealBoardRow> {
  const { data, error } = await supabase.from('deals').update(values).eq('id', id).select(BOARD_SELECT).single()

  if (error) throw error
  return flattenBoardRow(data)
}

// Moving a deal into a won/lost stage is a plain stage_id write — the
// `trg_deals_close_stamps` trigger in 001_initial_schema.sql sets (and clears)
// won_at/lost_at from the stage's is_won/is_lost, so the row has to be read
// back rather than patched optimistically.
export async function setDealStage(
  id: string,
  values: { stage_id: number; board_position: number },
): Promise<DealBoardRow> {
  const { data, error } = await supabase.from('deals').update(values).eq('id', id).select(BOARD_SELECT).single()

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
