import { Link } from 'react-router-dom'
import { usePipelineStages } from '@/lib/pipeline-stages'
import { formatCents, formatDate } from '@/lib/format'
import { StageBadge } from '@/components/StageBadge'
import { EmptyState } from '@/components/EmptyState'
import type { BackTarget } from '@/components/RecordPage'
import type { DealRow } from '@/types/crm'

/** `backTarget` is where the deal page should send you back to — the record
 * this list is hanging off, not the deals table. */
export function DealsByStage({ deals, backTarget }: { deals: DealRow[]; backTarget: BackTarget }) {
  const { stages } = usePipelineStages()

  if (deals.length === 0) {
    return <EmptyState title="No deals yet" />
  }

  const byStage = new Map<number, DealRow[]>()
  for (const deal of deals) {
    const list = byStage.get(deal.stage_id) ?? []
    list.push(deal)
    byStage.set(deal.stage_id, list)
  }

  const orderedStages = stages.filter((stage) => byStage.has(stage.id))

  return (
    <div className="space-y-5">
      {orderedStages.map((stage) => (
        <div key={stage.id}>
          <StageBadge stageKey={stage.key} label={stage.label} />
          <ul className="mt-2 space-y-2">
            {byStage.get(stage.id)!.map((deal) => (
              <li key={deal.id}>
                <Link
                  to={`/deals/${deal.id}`}
                  state={{ from: backTarget }}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{deal.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                      Close {formatDate(deal.expected_close_date)}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-medium">{formatCents(deal.value_cents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
