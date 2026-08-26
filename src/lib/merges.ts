import { supabase } from '@/lib/supabase'

export type MergeEntityType = 'contact' | 'organisation'

export interface MergeLogRow {
  id: string
  entityType: MergeEntityType
  survivorId: string
  mergedId: string
  mergedAt: string
  mergedBy: string | null
  /** The name of the record that was merged away, read back out of its snapshot. */
  mergedName: string | null
  /** Null when the survivor has itself since been merged away or deleted. */
  survivorName: string | null
  /** The whole deleted row. The only record of what it held. */
  snapshot: Record<string, unknown>
}

interface RawMergeLogRow {
  id: string
  entity_type: string
  survivor_id: string
  merged_id: string
  merged_at: string
  merged_by: string | null
  merged_name: string | null
  survivor_name: string | null
  merged_snapshot: Record<string, unknown> | null
}

// v_merge_log arrives in migration 007, so it isn't in the generated Database
// type yet — database.ts needs regenerating. The cast is confined to this file.
const client = supabase as unknown as {
  from: (relation: string) => {
    select: (columns: string) => {
      limit: (n: number) => Promise<{ data: RawMergeLogRow[] | null; error: { message: string } | null }>
    }
  }
}

export const MERGES_PAGE_SIZE = 100

/** Newest first — the view is already ordered that way. */
export async function listMerges(limit = MERGES_PAGE_SIZE): Promise<MergeLogRow[]> {
  const { data, error } = await client.from('v_merge_log').select('*').limit(limit)
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id,
    entityType: row.entity_type === 'organisation' ? 'organisation' : 'contact',
    survivorId: row.survivor_id,
    mergedId: row.merged_id,
    mergedAt: row.merged_at,
    mergedBy: row.merged_by,
    mergedName: row.merged_name,
    survivorName: row.survivor_name,
    snapshot: row.merged_snapshot ?? {},
  }))
}

// Import bookkeeping and machine keys — true of the row, but not what anyone
// is looking for when they open a snapshot to see what was lost.
const HIDDEN_SNAPSHOT_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'last_contacted_baseline',
])

const SNAPSHOT_LABELS: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  organisation_id: 'Organisation',
  is_primary: 'Primary contact',
  is_client: 'Client',
  last_contacted_at: 'Last contacted',
  account_number: 'Account number',
  legacy_capsule_id: 'Capsule ID',
  abn: 'ABN',
}

export interface SnapshotField {
  label: string
  value: string
}

/** The snapshot as readable label/value pairs, empties dropped. */
export function snapshotFields(snapshot: Record<string, unknown>): SnapshotField[] {
  return Object.entries(snapshot)
    .filter(([key, value]) => !HIDDEN_SNAPSHOT_FIELDS.has(key) && value !== null && value !== '')
    .map(([key, value]) => ({
      label: SNAPSHOT_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value),
    }))
}
