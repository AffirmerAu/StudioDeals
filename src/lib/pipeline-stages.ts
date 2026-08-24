import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PipelineStageRow } from '@/types/database'

let cache: Promise<PipelineStageRow[]> | null = null

async function loadPipelineStages(): Promise<PipelineStageRow[]> {
  const { data, error } = await supabase.from('pipeline_stages').select('*').order('position', { ascending: true })
  if (error) {
    cache = null
    throw error
  }
  return data ?? []
}

function fetchPipelineStages(): Promise<PipelineStageRow[]> {
  if (!cache) cache = loadPipelineStages()
  return cache
}

export function usePipelineStages(): { stages: PipelineStageRow[]; loading: boolean } {
  const [stages, setStages] = useState<PipelineStageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchPipelineStages()
      .then((data) => {
        if (!cancelled) setStages(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { stages, loading }
}
