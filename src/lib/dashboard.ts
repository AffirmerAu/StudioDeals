import { supabase } from '@/lib/supabase'
import type { DealsNeedingAttentionRow, PendingHandoffRow, PipelineForecastRow } from '@/types/crm'

export async function fetchPipelineForecast(): Promise<PipelineForecastRow[]> {
  const { data, error } = await supabase
    .from('v_pipeline_forecast')
    .select('*')
    .order('forecast_month', { ascending: true })

  if (error) throw error
  return (data ?? []) as PipelineForecastRow[]
}

export async function fetchDealsNeedingAttention(): Promise<DealsNeedingAttentionRow[]> {
  const { data, error } = await supabase.from('v_deals_needing_attention').select('*')
  if (error) throw error
  return (data ?? []) as DealsNeedingAttentionRow[]
}

export async function fetchPendingHandoff(): Promise<PendingHandoffRow[]> {
  const { data, error } = await supabase
    .from('v_pending_handoff')
    .select('*')
    .order('won_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PendingHandoffRow[]
}

export interface StageValueTotal {
  stageId: number
  count: number
  valueCents: number
}

export async function fetchOpenDealValueByStage(): Promise<StageValueTotal[]> {
  const { data, error } = await supabase.from('deals').select('stage_id, value_cents')
  if (error) throw error

  const totals = new Map<number, StageValueTotal>()
  for (const deal of data ?? []) {
    const existing = totals.get(deal.stage_id) ?? { stageId: deal.stage_id, count: 0, valueCents: 0 }
    existing.count += 1
    existing.valueCents += deal.value_cents
    totals.set(deal.stage_id, existing)
  }
  return Array.from(totals.values())
}

export async function fetchWonValueSince(
  wonStageIds: number[],
  sinceISODate: string,
): Promise<{ count: number; valueCents: number }> {
  if (wonStageIds.length === 0) return { count: 0, valueCents: 0 }

  const { data, error } = await supabase
    .from('deals')
    .select('value_cents')
    .in('stage_id', wonStageIds)
    .gte('won_at', sinceISODate)

  if (error) throw error
  const rows = data ?? []
  return { count: rows.length, valueCents: rows.reduce((sum, row) => sum + row.value_cents, 0) }
}

/** Deals created since a date — the "new deals this month" tile. Counted with
 * head:true so the rows themselves never come down the wire. */
export async function fetchNewDealCountSince(sinceISODate: string): Promise<number> {
  const { count, error } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceISODate)

  if (error) throw error
  return count ?? 0
}
