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

export interface DuplicateContactPair {
  idA: string
  nameA: string
  emailA: string | null
  idB: string
  nameB: string
  emailB: string | null
  organisationName: string | null
  /** What made this a candidate — a shared inbox, or a similar name at the same organisation. */
  matchOn: 'email' | 'name'
  score: number
}

export async function listDuplicateContactPairs(limit = 50): Promise<DuplicateContactPair[]> {
  // The view is already ordered by score — no .order() here, so a caller
  // can't accidentally re-sort away the email matches that lead it.
  const { data, error } = await supabase.from('v_possible_duplicate_contacts').select('*').limit(limit)
  if (error) throw error

  // Same narrowing as the organisations view above: every column comes back
  // nullable because it is a view, but the definition self-joins on non-null
  // columns, so a row it returns cannot have holes in its ids or names.
  return (data ?? [])
    .filter((row) => row.id_a && row.id_b)
    .map((row) => ({
      idA: row.id_a as string,
      nameA: row.name_a as string,
      emailA: row.email_a,
      idB: row.id_b as string,
      nameB: row.name_b as string,
      emailB: row.email_b,
      organisationName: row.organisation_name,
      matchOn: row.match_on === 'email' ? 'email' : 'name',
      score: row.score ?? 0,
    }))
}

/**
 * The function repoints deals, activities and taggings onto the survivor, logs
 * a snapshot of the duplicate to crm.merge_log, and deletes it, all in one
 * statement so a failure part-way leaves nothing half-merged.
 */
export async function mergeContacts(survivorId: string, loserId: string): Promise<void> {
  await callMerge('merge_contacts', survivorId, loserId)
}

/** Same, for organisations — see migrations/006. */
export async function mergeOrganisations(survivorId: string, loserId: string): Promise<void> {
  await callMerge('merge_organisations', survivorId, loserId)
}

async function callMerge(fn: 'merge_contacts' | 'merge_organisations', survivor: string, loser: string) {
  // Called as a method on supabase, never pulled out into a bare function:
  // detaching `supabase.rpc` from its receiver makes the call silently never
  // fire, which typecheck and build both let through.
  const { error } = await supabase.rpc(fn, { survivor, loser })
  if (error) throw error
}
