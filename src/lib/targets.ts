import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * crm.targets isn't in the generated Database type yet — database.ts needs
 * regenerating after migrations/004_targets.sql runs. Until then this module
 * owns the row shape by hand and narrows the client once, here, so the escape
 * hatch stays at this one boundary rather than leaking into the dashboard.
 */
export type TargetsRow = {
  id: number
  new_deals_per_month: number
  won_deals_per_month: number
  won_value_cents_per_month: number
  updated_at: string
}

type TargetsDatabase = {
  crm: {
    Tables: {
      targets: {
        Row: TargetsRow
        Insert: Partial<TargetsRow>
        Update: Partial<TargetsRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

const db = supabase as unknown as SupabaseClient<TargetsDatabase, 'crm'>

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
 * Fails soft: the dashboard is useful without targets, and before the
 * migration has been run the table simply isn't there. A missing table
 * shouldn't take the whole page down with it.
 */
export async function fetchTargets(): Promise<TargetValues> {
  const { data, error } = await db.from('targets').select('*').eq('id', 1).maybeSingle()
  if (error || !data) return NO_TARGETS

  return {
    new_deals_per_month: data.new_deals_per_month,
    won_deals_per_month: data.won_deals_per_month,
    won_value_cents_per_month: data.won_value_cents_per_month,
  }
}

export async function saveTargets(values: TargetValues): Promise<TargetValues> {
  const { data, error } = await db
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
