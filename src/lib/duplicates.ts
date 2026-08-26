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

interface RawDuplicateContactRow {
  id_a: string
  name_a: string
  email_a: string | null
  id_b: string
  name_b: string
  email_b: string | null
  organisation_name: string | null
  match_on: string
  score: number | null
}

/**
 * v_possible_duplicate_contacts and crm.merge_contacts arrive in migration
 * 007, so neither is in the generated Database type yet — database.ts needs
 * regenerating. The casts are confined to this file.
 */
const client = supabase as unknown as {
  from: (relation: string) => {
    select: (columns: string) => {
      limit: (n: number) => Promise<{ data: RawDuplicateContactRow[] | null; error: { message: string } | null }>
    }
  }
  rpc: (fn: string, args: Record<string, string>) => Promise<{ error: { message: string } | null }>
}

export async function listDuplicateContactPairs(limit = 50): Promise<DuplicateContactPair[]> {
  // The view is already ordered by score — no .order() here, so a caller
  // can't accidentally re-sort away the email matches that lead it.
  const { data, error } = await client.from('v_possible_duplicate_contacts').select('*').limit(limit)
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    idA: row.id_a,
    nameA: row.name_a,
    emailA: row.email_a,
    idB: row.id_b,
    nameB: row.name_b,
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

async function callMerge(fn: string, survivor: string, loser: string): Promise<void> {
  // Cast the client, not the method: pulling `supabase.rpc` out into a bare
  // function detaches it from its receiver and the call silently never fires.
  const { error } = await client.rpc(fn, { survivor, loser })
  if (error) throw new Error(error.message)
}
