import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

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

export const MERGES_PAGE_SIZE = 100

/** merged_snapshot is typed Json, which allows a string or a number as well.
 *  Every row the function writes is `to_jsonb(row)`, so it is always an
 *  object — but the type cannot know that, and a snapshot that somehow was
 *  not one should render as empty rather than crash the page. */
function asObject(value: Json | null): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** Newest first — the view is already ordered that way. */
export async function listMerges(limit = MERGES_PAGE_SIZE): Promise<MergeLogRow[]> {
  const { data, error } = await supabase.from('v_merge_log').select('*').limit(limit)
  if (error) throw error

  // Every column is nullable because it is a view, but id, survivor_id,
  // merged_id and merged_at all come straight off crm.merge_log's NOT NULL
  // columns — only the two resolved names are genuinely optional.
  return (data ?? []).map((row) => ({
    id: row.id as string,
    entityType: row.entity_type === 'organisation' ? 'organisation' : 'contact',
    survivorId: row.survivor_id as string,
    mergedId: row.merged_id as string,
    mergedAt: row.merged_at as string,
    mergedBy: row.merged_by,
    mergedName: row.merged_name,
    survivorName: row.survivor_name,
    snapshot: asObject(row.merged_snapshot),
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
