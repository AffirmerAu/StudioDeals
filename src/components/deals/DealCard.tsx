import { useSortable } from '@dnd-kit/sortable'
import { formatCents, formatDate } from '@/lib/format'
import { CompanyLogo } from '@/components/CompanyLogo'
import { DealCardMenu, type DealCardMenuProps } from '@/components/deals/DealCardMenu'
import type { DealBoardRow } from '@/lib/deals'

interface DealCardContentProps {
  deal: DealBoardRow
  /** The card's stage colour, so a card is placeable without reading a label. */
  stageColor?: string
  onClick?: () => void
  /** Omitted by DragOverlay, which renders a plain visual copy with no actions. */
  menu?: DealCardMenuProps
}

/** Pure presentational card — used directly by DragOverlay, which needs a
 * plain visual copy rather than a second `useSortable` registration for the
 * same id. */
export function DealCardContent({ deal, stageColor, onClick, menu }: DealCardContentProps) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg border p-3 text-sm transition-colors duration-150"
      style={{
        borderColor: 'var(--border)',
        // The wash sits under the card's own surface so the text keeps its
        // contrast; the accent rides in a box-shadow rather than the border,
        // which the hover handler below rewrites wholesale.
        background: stageColor
          ? `color-mix(in srgb, ${stageColor} 7%, var(--surface-raised))`
          : 'var(--surface-raised)',
        boxShadow: stageColor ? `inset 3px 0 0 ${stageColor}` : undefined,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-brand-500)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="truncate font-medium">{deal.title}</p>
        {menu && <DealCardMenu {...menu} />}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <CompanyLogo name={deal.organisation_name} website={deal.organisation_website} size={30} />
        <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
          {deal.organisation_name}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="tabular text-xs" style={{ color: 'var(--text-subtle)' }}>
          {formatDate(deal.expected_close_date)}
        </span>
        <span className="tabular text-sm font-medium">{formatCents(deal.value_cents)}</span>
      </div>
    </div>
  )
}

interface DealCardProps {
  deal: DealBoardRow
  stageColor: string
  onClick: () => void
  menu: DealCardMenuProps
}

export function DealCard({ deal, stageColor, onClick, menu }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: deal.id })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DealCardContent deal={deal} stageColor={stageColor} onClick={onClick} menu={menu} />
    </div>
  )
}
