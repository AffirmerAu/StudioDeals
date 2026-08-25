import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { formatCents } from '@/lib/format'
import { StageBadge, stageColor } from '@/components/StageBadge'
import { DealCard } from '@/components/deals/DealCard'
import type { DealBoardRow } from '@/lib/deals'
import type { PipelineStageRow } from '@/types/crm'

interface PipelineColumnProps {
  stage: PipelineStageRow
  deals: DealBoardRow[]
  onCardClick: (deal: DealBoardRow) => void
  onAddClick: (stageId: number) => void
  onViewDeal: (deal: DealBoardRow) => void
  onMarkWon: (deal: DealBoardRow) => void
  onMarkLost: (deal: DealBoardRow) => void
  onDeleteDeal: (deal: DealBoardRow) => void
}

export function PipelineColumn({
  stage,
  deals,
  onCardClick,
  onAddClick,
  onViewDeal,
  onMarkWon,
  onMarkLost,
  onDeleteDeal,
}: PipelineColumnProps) {
  const { setNodeRef } = useDroppable({ id: stage.id })
  const totalCents = deals.reduce((sum, deal) => sum + deal.value_cents, 0)
  const color = stageColor(stage.key)

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div
        className="mb-2 flex items-center justify-between rounded-lg border px-2 py-1.5"
        style={{
          // A wash, not a fill — the header has to stay quieter than the cards
          // below it while still reading as its stage at a glance.
          background: `color-mix(in srgb, ${color} 10%, transparent)`,
          borderColor: `color-mix(in srgb, ${color} 28%, transparent)`,
        }}
      >
        <StageBadge stageKey={stage.key} label={stage.label} />
        <span className="tabular text-xs" style={{ color: 'var(--text-subtle)' }}>
          {deals.length} · {formatCents(totalCents)}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 space-y-2 rounded-lg border p-2"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', minHeight: '4rem' }}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              stageColor={color}
              onClick={() => onCardClick(deal)}
              menu={{
                onEdit: () => onCardClick(deal),
                onView: () => onViewDeal(deal),
                onMarkWon: () => onMarkWon(deal),
                onMarkLost: () => onMarkLost(deal),
                onDelete: () => onDeleteDeal(deal),
                canMarkWon: !stage.is_won,
                canMarkLost: !stage.is_lost,
              }}
            />
          ))}
        </SortableContext>

        <button
          type="button"
          onClick={() => onAddClick(stage.id)}
          className="w-full rounded-lg border border-dashed py-2 text-xs font-medium transition-colors duration-150"
          style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)' }}
        >
          + Add deal
        </button>
      </div>
    </div>
  )
}
