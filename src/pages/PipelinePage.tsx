import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { usePipelineStages } from '@/lib/pipeline-stages'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { useToast } from '@/lib/toast-context'
import {
  computeBoardPosition,
  listDealsForBoard,
  updateDealPosition,
  type DealBoardRow,
} from '@/lib/deals'
import { SkeletonBlock } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { PipelineColumn } from '@/components/deals/PipelineColumn'
import { DealCardContent } from '@/components/deals/DealCard'
import { DealFormModal } from '@/components/deals/DealFormModal'

const DEAL_TYPE_OPTIONS = [
  { value: '', label: 'All deal types' },
  { value: 'production', label: 'Production' },
  { value: 'prestarter', label: 'Prestarter' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'other', label: 'Other' },
]

export function PipelinePage() {
  const { showToast } = useToast()
  const { stages, loading: stagesLoading } = usePipelineStages()
  const [searchParams, setSearchParams] = useSearchParams()

  const [deals, setDeals] = useState<DealBoardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [dealType, setDealType] = useState('')

  const [activeDeal, setActiveDeal] = useState<DealBoardRow | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<DealBoardRow | null>(null)
  const [createStageId, setCreateStageId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listDealsForBoard()
      .then((rows) => {
        if (!cancelled) setDeals(rows)
      })
      .catch((error: unknown) => {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Failed to load deals', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Deep link from the Dashboard's "needs attention" list.
  useEffect(() => {
    const dealId = searchParams.get('dealId')
    if (!dealId || loading) return
    const found = deals.find((d) => d.id === dealId)
    if (found) {
      setEditingDeal(found)
      setModalOpen(true)
    }
    setSearchParams((params) => {
      params.delete('dealId')
      return params
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const filteredDeals = useMemo(() => {
    let result = deals
    if (dealType) result = result.filter((d) => d.deal_type === dealType)
    const term = debouncedSearch.trim().toLowerCase()
    if (term) {
      result = result.filter(
        (d) => d.title.toLowerCase().includes(term) || d.organisation_name.toLowerCase().includes(term),
      )
    }
    return result
  }, [deals, dealType, debouncedSearch])

  const columns = useMemo(() => {
    const map = new Map<number, DealBoardRow[]>()
    for (const stage of stages) map.set(stage.id, [])
    for (const deal of filteredDeals) {
      map.get(deal.stage_id)?.push(deal)
    }
    for (const list of map.values()) list.sort((a, b) => a.board_position - b.board_position)
    return map
  }, [filteredDeals, stages])

  const openCreateModal = (stageId: number) => {
    setEditingDeal(null)
    setCreateStageId(stageId)
    setModalOpen(true)
  }

  const openEditModal = (deal: DealBoardRow) => {
    setEditingDeal(deal)
    setCreateStageId(null)
    setModalOpen(true)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const found = deals.find((d) => d.id === event.active.id)
    setActiveDeal(found ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDeal(null)
    const { active, over } = event
    if (!over) return

    const dragged = deals.find((d) => d.id === active.id)
    if (!dragged) return

    const overIsColumn = typeof over.id === 'number'
    const destStageId = overIsColumn ? (over.id as number) : deals.find((d) => d.id === over.id)?.stage_id
    if (destStageId === undefined) return

    const destDeals = (columns.get(destStageId) ?? []).filter((d) => d.id !== dragged.id)
    const destIndex = overIsColumn ? destDeals.length : destDeals.findIndex((d) => d.id === over.id)
    const newPosition = computeBoardPosition(destDeals, destIndex === -1 ? destDeals.length : destIndex)

    if (dragged.stage_id === destStageId && dragged.board_position === newPosition) return

    const previous = deals
    setDeals((current) =>
      current.map((d) => (d.id === dragged.id ? { ...d, stage_id: destStageId, board_position: newPosition } : d)),
    )

    updateDealPosition(dragged.id, { stage_id: destStageId, board_position: newPosition }).catch(
      (error: unknown) => {
        setDeals(previous)
        showToast(error instanceof Error ? error.message : 'Failed to move deal', 'error')
      },
    )
  }

  return (
    <div className="flex h-full flex-col p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
        <button
          type="button"
          onClick={() => openCreateModal(stages[0]?.id ?? 1)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150"
          style={{ background: 'var(--color-brand-500)' }}
        >
          New deal
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or organisation…"
          className="w-72 rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text)' }}
        />
        <select
          value={dealType}
          onChange={(e) => setDealType(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text)' }}
        >
          {DEAL_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {(loading || stagesLoading) && (
        <div className="mt-5 flex gap-4 overflow-x-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-96 w-72 shrink-0" />
          ))}
        </div>
      )}

      {!loading && !stagesLoading && deals.length === 0 && (
        <div className="mt-5">
          <EmptyState title="No deals yet" hint="Create your first deal to get started." />
        </div>
      )}

      {!loading && !stagesLoading && deals.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDeal(null)}
        >
          <div className="mt-5 flex flex-1 gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                deals={columns.get(stage.id) ?? []}
                onCardClick={openEditModal}
                onAddClick={openCreateModal}
              />
            ))}
          </div>
          <DragOverlay>{activeDeal && <DealCardContent deal={activeDeal} />}</DragOverlay>
        </DndContext>
      )}

      <DealFormModal
        open={modalOpen}
        deal={editingDeal}
        defaultStageId={createStageId ?? stages[0]?.id ?? 1}
        computeCreatePosition={(stageId) => computeBoardPosition(columns.get(stageId) ?? [], (columns.get(stageId) ?? []).length)}
        onClose={() => setModalOpen(false)}
        onSaved={(saved) => {
          setDeals((current) => {
            const exists = current.some((d) => d.id === saved.id)
            return exists ? current.map((d) => (d.id === saved.id ? saved : d)) : [...current, saved]
          })
          setModalOpen(false)
        }}
        onSaveFailed={(previous) => {
          setDeals((current) => current.map((d) => (d.id === previous.id ? previous : d)))
        }}
      />
    </div>
  )
}
