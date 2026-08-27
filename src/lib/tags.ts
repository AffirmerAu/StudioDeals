import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { TagRow } from '@/types/crm'

/** A tagging hangs off exactly one of the two — crm.taggings enforces it with
 *  `check (num_nonnulls(organisation_id, contact_id) = 1)`. */
export type TagTarget = { kind: 'organisation'; id: string } | { kind: 'contact'; id: string }

const columnFor = (target: TagTarget) =>
  target.kind === 'organisation' ? 'organisation_id' : 'contact_id'

// Postgres unique-violation. Both writes below can hit one legitimately when
// two people act at once, and in both cases the outcome the caller wanted is
// already true, so it is not an error to report.
const UNIQUE_VIOLATION = '23505'

// ------------------------------------------------------------ the vocabulary

let cache: Promise<TagRow[]> | null = null
const listeners = new Set<() => void>()

async function loadTags(): Promise<TagRow[]> {
  const { data, error } = await supabase.from('tags').select('*').order('label', { ascending: true })
  if (error) {
    cache = null
    throw error
  }
  return data ?? []
}

function fetchTags(): Promise<TagRow[]> {
  if (!cache) cache = loadTags()
  return cache
}

/** Creating a tag has to reach every list showing the vocabulary — the picker
 *  that made it, any other one open, and the contacts filter — or the new tag
 *  stays invisible until a reload. */
function invalidateTags(): void {
  cache = null
  for (const listener of listeners) listener()
}

export function useTags(): { tags: TagRow[]; loading: boolean } {
  const [tags, setTags] = useState<TagRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetchTags()
        .then((data) => {
          if (!cancelled) setTags(data)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }

    load()
    listeners.add(load)
    return () => {
      cancelled = true
      listeners.delete(load)
    }
  }, [])

  return { tags, loading }
}

/**
 * Returns the existing tag when one matches case-insensitively, so "Safety"
 * typed against an existing "safety" reuses it rather than making a second
 * tag. migrations/008 puts a unique index on lower(label) behind this, which
 * is what makes it true rather than merely likely — two people creating at
 * once would otherwise both pass this check.
 */
export async function findOrCreateTag(label: string): Promise<TagRow> {
  const trimmed = label.trim()
  if (!trimmed) throw new Error('A tag needs a label')

  const existing = matchLabel(await fetchTags(), trimmed)
  if (existing) return existing

  // kind is left at its default of 'label'. The other kinds ('source',
  // 'industry', 'event') came from the Capsule import and nothing in the app
  // distinguishes them, so exposing the choice would be noise.
  const { data, error } = await supabase.from('tags').insert({ label: trimmed }).select('*').single()

  if (error) {
    if (error.code !== UNIQUE_VIOLATION) throw error
    // Someone else created it between the check and the insert.
    invalidateTags()
    const raced = matchLabel(await fetchTags(), trimmed)
    if (raced) return raced
    throw error
  }

  invalidateTags()
  return data
}

export function matchLabel(tags: TagRow[], label: string): TagRow | undefined {
  const needle = label.trim().toLowerCase()
  return tags.find((tag) => tag.label.toLowerCase() === needle)
}

// --------------------------------------------------------------- the taggings

export async function fetchTagsFor(target: TagTarget): Promise<TagRow[]> {
  const { data: taggings, error } = await supabase
    .from('taggings')
    .select('tag_id')
    .eq(columnFor(target), target.id)

  if (error) throw error

  const tagIds = new Set((taggings ?? []).map((row) => row.tag_id))
  if (tagIds.size === 0) return []

  // Resolved against the cached vocabulary rather than a second round trip —
  // crm.tags is a handful of rows and every caller has already loaded it.
  return (await fetchTags()).filter((tag) => tagIds.has(tag.id))
}

export async function attachTag(target: TagTarget, tagId: number): Promise<void> {
  // One object with both columns rather than a computed key or a union: a
  // computed key widens to an index signature and a union resolves against
  // its first branch, and postgrest-js's insert type rejects both. Exactly
  // one of the two is non-null, which is what the table's check constraint
  // asks for.
  const { error } = await supabase.from('taggings').insert({
    tag_id: tagId,
    organisation_id: target.kind === 'organisation' ? target.id : null,
    contact_id: target.kind === 'contact' ? target.id : null,
  })
  // Already applied: the partial unique index on (tag_id, organisation_id) /
  // (tag_id, contact_id) caught it, and the tag is on the record either way.
  if (error && error.code !== UNIQUE_VIOLATION) throw error
}

export async function detachTag(target: TagTarget, tagId: number): Promise<void> {
  const { error } = await supabase
    .from('taggings')
    .delete()
    .eq(columnFor(target), target.id)
    .eq('tag_id', tagId)

  if (error) throw error
}

export async function contactIdsForTag(tagId: number): Promise<string[]> {
  return idsForTag(tagId, 'contact_id')
}

export async function organisationIdsForTag(tagId: number): Promise<string[]> {
  return idsForTag(tagId, 'organisation_id')
}

async function idsForTag(tagId: number, column: 'contact_id' | 'organisation_id'): Promise<string[]> {
  const { data, error } = await supabase.from('taggings').select(column).eq('tag_id', tagId)

  if (error) throw error
  return (data ?? [])
    .map((row) => (row as Record<string, string | null>)[column])
    .filter((id): id is string => id !== null)
}
