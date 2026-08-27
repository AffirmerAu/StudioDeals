import { supabase } from '@/lib/supabase'
import type { TargetsRow } from '@/types/crm'

export type TargetValues = Pick<
  TargetsRow,
  'new_deals_per_month' | 'won_deals_per_month' | 'won_value_cents_per_month'
>

export const NO_TARGETS: TargetValues = {
  new_deals_per_month: 0,
  won_deals_per_month: 0,
  won_value_cents_per_month: 0,
}

/**
 * Fails soft: the dashboard is useful without targets, and 004 seeds exactly
 * one row that nothing can delete through the UI — but a missing row should
 * show as "no target set" rather than taking the whole page down.
 */
export async function fetchTargets(): Promise<TargetValues> {
  const { data, error } = await supabase.from('targets').select('*').eq('id', 1).maybeSingle()
  if (error || !data) return NO_TARGETS

  return {
    new_deals_per_month: data.new_deals_per_month,
    won_deals_per_month: data.won_deals_per_month,
    won_value_cents_per_month: data.won_value_cents_per_month,
  }
}

export async function saveTargets(values: TargetValues): Promise<TargetValues> {
  const { data, error } = await supabase
    .from('targets')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('*')
    .single()

  if (error) throw error
  return {
    new_deals_per_month: data.new_deals_per_month,
    won_deals_per_month: data.won_deals_per_month,
    won_value_cents_per_month: data.won_value_cents_per_month,
  }
}
