import type { DealBoardRow, DealFormValues } from '@/lib/deals'
import { centsToDollarInput, dollarInputToCents } from '@/lib/format'

// The generated Row type has deal_type: string — Postgres CHECK constraints
// aren't reflected in `supabase gen types`. This mirrors the constraint from
// migrations/001_initial_schema.sql: check (deal_type in (...)).
export type DealType = 'production' | 'prestarter' | 'retainer' | 'other'

export const DEAL_TYPES: { value: DealType; label: string }[] = [
  { value: 'production', label: 'Production' },
  { value: 'prestarter', label: 'Prestarter' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'other', label: 'Other' },
]

export const DEAL_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DEAL_TYPES.map((type) => [type.value, type.label]),
)

export interface DealFormState {
  title: string
  stage_id: number
  deal_type: DealType
  valueDollars: string
  expected_close_date: string
  source: string
  notes: string
  /** Whole percent, or '' to fall back to the stage's own probability. */
  probabilityPercent: string
  lostReason: string
}

/** Whole percent in, 0–1 out. Anything outside 0–100 is treated as no
 * override rather than clamped, so a typo doesn't silently skew the forecast. */
export function percentToProbability(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const n = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return n / 100
}

export function emptyDealFormState(defaultStageId: number): DealFormState {
  return {
    title: '',
    stage_id: defaultStageId,
    deal_type: 'production',
    valueDollars: '',
    expected_close_date: '',
    source: '',
    notes: '',
    probabilityPercent: '',
    lostReason: '',
  }
}

export function toDealFormState(deal: DealBoardRow): DealFormState {
  return {
    title: deal.title,
    stage_id: deal.stage_id,
    deal_type: deal.deal_type as DealType,
    valueDollars: deal.value_cents ? centsToDollarInput(deal.value_cents) : '',
    expected_close_date: deal.expected_close_date ?? '',
    source: deal.source ?? '',
    notes: deal.notes ?? '',
    // Stored 0–1, shown as whole percent: people think in percentages, and
    // numeric(3,2) can't hold more precision than that anyway.
    probabilityPercent:
      deal.probability_override === null ? '' : String(Math.round(deal.probability_override * 100)),
    lostReason: deal.lost_reason ?? '',
  }
}

export function dealFormValues(
  state: DealFormState,
  organisationId: string,
  contactId: string | null,
  isLostStage: boolean,
): DealFormValues {
  return {
    title: state.title.trim(),
    organisation_id: organisationId,
    primary_contact_id: contactId,
    stage_id: state.stage_id,
    deal_type: state.deal_type,
    value_cents: state.valueDollars.trim() ? dollarInputToCents(state.valueDollars) : 0,
    expected_close_date: state.expected_close_date || null,
    source: state.source.trim() || null,
    notes: state.notes.trim() || null,
    probability_override: percentToProbability(state.probabilityPercent),
    // Only meaningful on a lost deal; moving off Lost clears it rather than
    // leaving a stale reason attached to a live deal.
    lost_reason: isLostStage ? state.lostReason.trim() || null : null,
  }
}
