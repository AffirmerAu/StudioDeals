import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { TagRow } from '@/types/crm'

let cache: Promise<TagRow[]> | null = null

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

export function useTags(): { tags: TagRow[]; loading: boolean } {
  const [tags, setTags] = useState<TagRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchTags()
      .then((data) => {
        if (!cancelled) setTags(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { tags, loading }
}

export async function fetchOrganisationTags(organisationId: string): Promise<TagRow[]> {
  const { data: taggings, error: taggingsError } = await supabase
    .from('taggings')
    .select('tag_id')
    .eq('organisation_id', organisationId)
  if (taggingsError) throw taggingsError

  const tagIds = taggings.map((row) => row.tag_id)
  if (tagIds.length === 0) return []

  const { data: tags, error: tagsError } = await supabase.from('tags').select('*').in('id', tagIds)
  if (tagsError) throw tagsError
  return tags ?? []
}

export async function contactIdsForTag(tagId: number): Promise<string[]> {
  const { data, error } = await supabase.from('taggings').select('contact_id').eq('tag_id', tagId)

  if (error) throw error
  return (data ?? [])
    .map((row) => row.contact_id)
    .filter((id): id is string => id !== null)
}
