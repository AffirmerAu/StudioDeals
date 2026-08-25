import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PipelineStageRow } from '@/types/crm'

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

/**
 * Coarse phase colour for a stage, used to tint the board's column headers.
 *
 * Derived from the stage's own flags and its position among the open stages
 * rather than a hardcoded key map, so renaming a stage or inserting a new one
 * in crm.pipeline_stages keeps working: the earlier half of the open stages
 * reads as "early", the later half as "active". For the current six stages
 * that lands New/Meeting on blue and Proposal/Verbal Approval on orange.
 */
export function stagePhaseColor(stage: PipelineStageRow, stages: PipelineStageRow[]): string {
  if (stage.is_won) return 'var(--color-phase-won)'
  if (stage.is_lost) return 'var(--color-phase-lost)'

  const open = stages.filter((s) => !s.is_won && !s.is_lost)
  const index = open.findIndex((s) => s.id === stage.id)
  if (index === -1) return 'var(--color-phase-early)'

  return index < Math.ceil(open.length / 2) ? 'var(--color-phase-early)' : 'var(--color-phase-active)'
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
