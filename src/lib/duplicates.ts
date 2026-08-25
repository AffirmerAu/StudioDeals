import { supabase } from '@/lib/supabase'

export interface DuplicateOrgPair {
  idA: string
  nameA: string
  idB: string
  nameB: string
  score: number
}

/**
 * v_possible_duplicate_orgs pairs organisations whose names score above 0.45
 * on pg_trgm similarity, highest first. The view has existed since 001 and
 * nothing consumed it until now.
 */
export async function listDuplicateOrgPairs(limit = 50): Promise<DuplicateOrgPair[]> {
  const { data, error } = await supabase
    .from('v_possible_duplicate_orgs')
    .select('*')
    .order('score', { ascending: false })
    .limit(limit)

  if (error) throw error

  // Every column is marked nullable because it's a view, but the view's own
  // definition is a self-join on non-null columns — a row can't have holes.
  return (data ?? [])
    .filter((row) => row.id_a && row.id_b)
    .map((row) => ({
      idA: row.id_a as string,
      nameA: row.name_a as string,
      idB: row.id_b as string,
      nameB: row.name_b as string,
      score: row.score ?? 0,
    }))
}

/**
 * crm.merge_organisations isn't in the generated Database type — database.ts
 * has `Functions: { [_ in never]: never }` and needs regenerating after
 * migrations/006. The cast is confined to this one call.
 *
 * The function repoints contacts, deals, activities and taggings onto the
 * survivor, logs a snapshot of the duplicate to crm.merge_log, and deletes it,
 * all in one statement so a failure part-way leaves nothing half-merged.
 */
export async function mergeOrganisations(survivorId: string, loserId: string): Promise<void> {
  // Cast the client, not the method: pulling `supabase.rpc` out into a bare
  // function detaches it from its receiver and the call silently never fires.
  const client = supabase as unknown as {
    rpc: (fn: string, args: Record<string, string>) => Promise<{ error: { message: string } | null }>
  }

  const { error } = await client.rpc('merge_organisations', { survivor: survivorId, loser: loserId })
  if (error) throw new Error(error.message)
}
