import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  deleteDeal,
  listDealsForBoard,
  setDealLostReason,
  markDealHandedOff,
  setDealStage,
  updateDealPosition,
  type DealBoardRow,
} from '@/lib/deals'
import { SkeletonBlock } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LostReasonDialog } from '@/components/deals/LostReasonDialog'
import { PipelineColumn } from '@/components/deals/PipelineColumn'
import { DealCardContent } from '@/components/deals/DealCard'
import { DealFormModal } from '@/components/deals/DealFormModal'
import type { PipelineStageRow } from '@/types/crm'

const DEAL_TYPE_OPTIONS = [
  { value: '', label: 'All deal types' },
  { value: 'production', label: 'Production' },
  { value: 'prestarter', label: 'Prestarter' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'other', label: 'Other' },
]

const BACK_TO_PIPELINE = { to: '/pipeline', label: 'Pipeline' }

const SHOW_WON_KEY = 'studiodeals-pipeline-show-won'
const SHOW_LOST_KEY = 'studiodeals-pipeline-show-lost'

function getStoredFlag(key: string): boolean {
  return localStorage.getItem(key) === 'true'
}

export function PipelinePage() {
  const { showToast } = useToast()
  const { stages, loading: stagesLoading } = usePipelineStages()
  const navigate = useNavigate()

  const [deals, setDeals] = useState<DealBoardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [dealType, setDealType] = useState('')

  // Won and Lost columns are closed by default — they only grow, and the board
  // is about work in flight. The preference sticks per browser.
  const [showWon, setShowWon] = useState(() => getStoredFlag(SHOW_WON_KEY))
  const [showLost, setShowLost] = useState(() => getStoredFlag(SHOW_LOST_KEY))

  const [activeDeal, setActiveDeal] = useState<DealBoardRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createStageId, setCreateStageId] = useState<number | null>(null)

  const [handoffDeal, setHandoffDeal] = useState<DealBoardRow | null>(null)
  const [handoffBusy, setHandoffBusy] = useState(false)
  const [deletingDeal, setDeletingDeal] = useState<DealBoardRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  // Two shapes of "mark lost": from the menu the stage move is still pending,
  // from a drag it has already happened and only the reason is outstanding.
  const [lostPrompt, setLostPrompt] = useState<{ deal: DealBoardRow; stage: PipelineStageRow | null } | null>(null)
  const [lostBusy, setLostBusy] = useState(false)

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

  const wonStage = stages.find((s) => s.is_won)
  const lostStage = stages.find((s) => s.is_lost)

  const visibleStages = stages.filter((stage) => {
    if (stage.is_won) return showWon
    if (stage.is_lost) return showLost
    return true
  })

  const toggleWon = (next: boolean) => {
    setShowWon(next)
    localStorage.setItem(SHOW_WON_KEY, String(next))
  }

  const toggleLost = (next: boolean) => {
    setShowLost(next)
    localStorage.setItem(SHOW_LOST_KEY, String(next))
  }

  const isWonStage = (stageId: number) => stages.find((s) => s.id === stageId)?.is_won ?? false

  // Only prompt for a genuine transition into Won — not a reorder within
  // Won, not a re-save of an already-Won deal, not non-production deals
  // (matches v_pending_handoff's own filter), and never twice for the same
  // deal.
  const maybePromptHandoff = (previousStageId: number | null, deal: DealBoardRow) => {
    if (deal.deal_type !== 'production') return
    if (deal.handed_off_at) return
    if (!isWonStage(deal.stage_id)) return
    if (previousStageId !== null && isWonStage(previousStageId)) return
    setHandoffDeal(deal)
  }

  const isLostStage = (stageId: number) => stages.find((s) => s.id === stageId)?.is_lost ?? false

  /** Only on a genuine move into Lost — not a reorder within it. */
  const maybePromptLostReason = (previousStageId: number, deal: DealBoardRow) => {
    if (!isLostStage(deal.stage_id)) return
    if (isLostStage(previousStageId)) return
    setLostPrompt({ deal, stage: null })
  }

  const openCreateModal = (stageId: number) => {
    setCreateStageId(stageId)
    setCreateOpen(true)
  }

  const openDeal = (deal: DealBoardRow) => {
    navigate(`/deals/${deal.id}`, { state: { from: BACK_TO_PIPELINE } })
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
    const updatedDeal = { ...dragged, stage_id: destStageId, board_position: newPosition }
    setDeals((current) => current.map((d) => (d.id === dragged.id ? updatedDeal : d)))
    maybePromptHandoff(dragged.stage_id, updatedDeal)
    maybePromptLostReason(dragged.stage_id, updatedDeal)

    updateDealPosition(dragged.id, { stage_id: destStageId, board_position: newPosition }).catch(
      (error: unknown) => {
        setDeals(previous)
        showToast(error instanceof Error ? error.message : 'Failed to move deal', 'error')
      },
    )
  }

  // Won/Lost from the card menu. Unlike a drag this can't be applied
  // optimistically: the close-stamp trigger fills in won_at/lost_at server-side,
  // so the saved row is read back. The destination column is revealed if it was
  // collapsed, otherwise the card would appear to vanish.
  const handleMarkStage = async (deal: DealBoardRow, stage: PipelineStageRow, lostReason?: string | null) => {
    const destDeals = (columns.get(stage.id) ?? []).filter((d) => d.id !== deal.id)
    const boardPosition = computeBoardPosition(destDeals, destDeals.length)
    const previousStageId = deal.stage_id

    if (stage.is_won) toggleWon(true)
    if (stage.is_lost) toggleLost(true)

    try {
      const saved = await setDealStage(deal.id, {
        stage_id: stage.id,
        board_position: boardPosition,
        ...(stage.is_lost ? { lost_reason: lostReason ?? null } : {}),
      })
      setDeals((current) => current.map((d) => (d.id === saved.id ? saved : d)))
      showToast(`Marked as ${stage.label}`)
      maybePromptHandoff(previousStageId, saved)
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Failed to mark as ${stage.label}`, 'error')
    }
  }

  const handleConfirmLost = async (reason: string | null) => {
    if (!lostPrompt) return
    setLostBusy(true)
    try {
      if (lostPrompt.stage) {
        // Menu path — the stage change hasn't happened yet.
        await handleMarkStage(lostPrompt.deal, lostPrompt.stage, reason)
      } else {
        // Drag path — already in Lost, so only the reason is left to record.
        const saved = await setDealLostReason(lostPrompt.deal.id, reason)
        setDeals((current) => current.map((d) => (d.id === saved.id ? saved : d)))
      }
      setLostPrompt(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to record the reason', 'error')
    } finally {
      setLostBusy(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingDeal) return
    setDeleteBusy(true)
    try {
      await deleteDeal(deletingDeal.id)
      setDeals((current) => current.filter((d) => d.id !== deletingDeal.id))
      showToast('Deal deleted')
      setDeletingDeal(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete deal', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const handleConfirmHandoff = async () => {
    if (!handoffDeal) return
    setHandoffBusy(true)
    try {
      const { handedOffAt } = await markDealHandedOff(handoffDeal.id)
      setDeals((current) =>
        current.map((d) => (d.id === handoffDeal.id ? { ...d, handed_off_at: handedOffAt } : d)),
      )
      showToast('Queued for StudioTime handoff')
      setHandoffDeal(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to record handoff', 'error')
    } finally {
      setHandoffBusy(false)
    }
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

        {wonStage && (
          <ColumnToggle
            label={wonStage.label}
            count={(columns.get(wonStage.id) ?? []).length}
            active={showWon}
            color="var(--color-stage-won)"
            onToggle={() => toggleWon(!showWon)}
          />
        )}
        {lostStage && (
          <ColumnToggle
            label={lostStage.label}
            count={(columns.get(lostStage.id) ?? []).length}
            active={showLost}
            color="var(--color-stage-lost)"
            onToggle={() => toggleLost(!showLost)}
          />
        )}
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
            {visibleStages.map((stage) => (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                deals={columns.get(stage.id) ?? []}
                onCardClick={openDeal}
                onAddClick={openCreateModal}
                onMarkWon={(deal) => wonStage && void handleMarkStage(deal, wonStage)}
                onMarkLost={(deal) => lostStage && setLostPrompt({ deal, stage: lostStage })}
                onDeleteDeal={setDeletingDeal}
              />
            ))}
          </div>
          <DragOverlay>{activeDeal && <DealCardContent deal={activeDeal} />}</DragOverlay>
        </DndContext>
      )}

      <DealFormModal
        open={createOpen}
        defaultStageId={createStageId ?? stages[0]?.id ?? 1}
        computeCreatePosition={(stageId) => computeBoardPosition(columns.get(stageId) ?? [], (columns.get(stageId) ?? []).length)}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          setDeals((current) => [...current, created])
          setCreateOpen(false)
          maybePromptHandoff(null, created)
        }}
      />

      <LostReasonDialog
        open={lostPrompt !== null}
        dealTitle={lostPrompt?.deal.title ?? ''}
        initialReason={lostPrompt?.deal.lost_reason}
        busy={lostBusy}
        onConfirm={handleConfirmLost}
        onClose={() => setLostPrompt(null)}
      />

      <ConfirmDialog
        open={deletingDeal !== null}
        title="Delete deal"
        message={
          deletingDeal
            ? `Delete "${deletingDeal.title}"? Any activities logged against it are deleted too. This can't be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingDeal(null)}
      />

      <ConfirmDialog
        open={handoffDeal !== null}
        title="Send to StudioTime?"
        message={
          handoffDeal
            ? `Send "${handoffDeal.title}" to StudioTime? You can also do this later from the dashboard.`
            : ''
        }
        confirmLabel="Send"
        busy={handoffBusy}
        onConfirm={handleConfirmHandoff}
        onClose={() => setHandoffDeal(null)}
      />
    </div>
  )
}

function ColumnToggle({
  label,
  count,
  active,
  color,
  onToggle,
}: {
  label: string
  count: number
  active: boolean
  color: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150"
      style={{
        borderColor: active ? color : 'var(--border)',
        background: active ? 'var(--surface-hover)' : 'var(--surface-raised)',
        color: active ? color : 'var(--text-muted)',
      }}
    >
      <span className="size-1.5 rounded-lg" style={{ background: active ? color : 'var(--text-subtle)' }} />
      {active ? 'Hide' : 'Show'} {label}
      <span className="tabular text-xs" style={{ color: 'var(--text-subtle)' }}>
        {count}
      </span>
    </button>
  )
}
