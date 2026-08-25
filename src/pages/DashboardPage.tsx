import { useEffect, useState } from 'react'
import { usePipelineStages } from '@/lib/pipeline-stages'
import { useToast } from '@/lib/toast-context'
import {
  fetchDealsNeedingAttention,
  fetchOpenDealValueByStage,
  fetchPendingHandoff,
  fetchPipelineForecast,
  fetchWonValueSince,
  type StageValueTotal,
} from '@/lib/dashboard'
import { markDealHandedOff } from '@/lib/deals'
import { formatCents, formatDate } from '@/lib/format'
import { StatTile } from '@/components/StatTile'
import { SkeletonBlock } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { StageValueChart } from '@/components/deals/StageValueChart'
import { ForecastChart } from '@/components/deals/ForecastChart'
import { NeedsAttentionList } from '@/components/deals/NeedsAttentionList'
import type { DealsNeedingAttentionRow, PendingHandoffRow, PipelineForecastRow } from '@/types/crm'

function startOfMonthISO(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

export function DashboardPage() {
  const { showToast } = useToast()
  const { stages, loading: stagesLoading } = usePipelineStages()

  const [loading, setLoading] = useState(true)
  const [stageValues, setStageValues] = useState<StageValueTotal[]>([])
  const [forecast, setForecast] = useState<PipelineForecastRow[]>([])
  const [needsAttention, setNeedsAttention] = useState<DealsNeedingAttentionRow[]>([])
  const [pendingHandoff, setPendingHandoff] = useState<PendingHandoffRow[]>([])
  const [wonThisMonth, setWonThisMonth] = useState({ count: 0, valueCents: 0 })
  const [handoffDeal, setHandoffDeal] = useState<PendingHandoffRow | null>(null)
  const [handoffBusy, setHandoffBusy] = useState(false)

  useEffect(() => {
    if (stagesLoading) return
    let cancelled = false
    const wonStageIds = stages.filter((s) => s.is_won).map((s) => s.id)

    setLoading(true)
    Promise.all([
      fetchOpenDealValueByStage(),
      fetchPipelineForecast(),
      fetchDealsNeedingAttention(),
      fetchPendingHandoff(),
      fetchWonValueSince(wonStageIds, startOfMonthISO()),
    ])
      .then(([values, forecastRows, attention, handoff, won]) => {
        if (cancelled) return
        setStageValues(values)
        setForecast(forecastRows)
        setNeedsAttention(attention)
        setPendingHandoff(handoff)
        setWonThisMonth(won)
      })
      .catch((error: unknown) => {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Failed to load dashboard', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagesLoading])

  const handleConfirmHandoff = async () => {
    if (!handoffDeal) return
    setHandoffBusy(true)
    try {
      await markDealHandedOff(handoffDeal.id)
      setPendingHandoff((current) => current.filter((d) => d.id !== handoffDeal.id))
      showToast('Queued for StudioTime handoff')
      setHandoffDeal(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to record handoff', 'error')
    } finally {
      setHandoffBusy(false)
    }
  }

  const openStages = new Set(stages.filter((s) => !s.is_won && !s.is_lost).map((s) => s.id))
  const openValueCents = stageValues
    .filter((s) => openStages.has(s.stageId))
    .reduce((sum, s) => sum + s.valueCents, 0)
  const weightedForecastCents = forecast.reduce((sum, row) => sum + row.weighted_value_cents, 0)

  if (loading || stagesLoading) {
    return (
      <div className="p-8 space-y-5">
        <SkeletonBlock className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-20" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonBlock className="h-72" />
          <SkeletonBlock className="h-72" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Open pipeline value" value={formatCents(openValueCents)} />
        <StatTile label="Weighted forecast" value={formatCents(weightedForecastCents)} />
        <StatTile label="Won this month" value={formatCents(wonThisMonth.valueCents)} />
        <StatTile label="Pending handoff" value={String(pendingHandoff.length)} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StageValueChart stages={stages} totals={stageValues} />
        <ForecastChart rows={forecast} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NeedsAttentionList rows={needsAttention} />

        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
          <h3 className="text-sm font-semibold tracking-tight">Pending handoff to StudioTime</h3>
          {pendingHandoff.length === 0 ? (
            <div className="mt-2">
              <EmptyState title="Nothing pending handoff" />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {pendingHandoff.map((deal) => (
                <li
                  key={deal.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{deal.title}</p>
                    <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                      {deal.organisation_name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular text-xs" style={{ color: 'var(--text-subtle)' }}>
                      Won {formatDate(deal.won_at)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHandoffDeal(deal)}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-white transition-colors duration-150"
                      style={{ background: 'var(--color-brand-500)' }}
                    >
                      Send
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={handoffDeal !== null}
        title="Send to StudioTime?"
        message={handoffDeal ? `Send "${handoffDeal.title}" to StudioTime?` : ''}
        confirmLabel="Send"
        busy={handoffBusy}
        onConfirm={handleConfirmHandoff}
        onClose={() => setHandoffDeal(null)}
      />
    </div>
  )
}
