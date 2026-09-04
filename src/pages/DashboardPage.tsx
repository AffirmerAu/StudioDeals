import { Suspense, lazy, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePipelineStages } from '@/lib/pipeline-stages'
import { useToast } from '@/lib/toast-context'
import {
  fetchDealsNeedingAttention,
  fetchNewDealCountSince,
  fetchOpenDealValueByStage,
  fetchPipelineForecast,
  fetchWonValueSince,
  type StageValueTotal,
} from '@/lib/dashboard'
import { isOverdue, listOpenFollowUps, setActivityCompleted, type OpenFollowUpRow } from '@/lib/activities'
import { fetchTargets, NO_TARGETS, type TargetValues } from '@/lib/targets'
import { FollowUpsList } from '@/components/FollowUpsList'
import { TargetTile } from '@/components/TargetTile'
import { TargetsFormModal } from '@/components/TargetsFormModal'
import { formatCents } from '@/lib/format'
import { StatTile } from '@/components/StatTile'
import { SkeletonBlock } from '@/components/Skeleton'
import { NeedsAttentionList } from '@/components/deals/NeedsAttentionList'
import type { DealsNeedingAttentionRow, PipelineForecastRow } from '@/types/crm'

// Recharts is the single largest dependency in the app and only these two
// components touch it. Loading them lazily keeps it off the landing route's
// critical path — the tiles and lists paint while the charts stream in.
const StageValueChart = lazy(() =>
  import('@/components/deals/StageValueChart').then((m) => ({ default: m.StageValueChart })),
)
const ForecastChart = lazy(() =>
  import('@/components/deals/ForecastChart').then((m) => ({ default: m.ForecastChart })),
)

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
  const [wonThisMonth, setWonThisMonth] = useState({ count: 0, valueCents: 0 })
  const [openFollowUps, setOpenFollowUps] = useState<OpenFollowUpRow[]>([])
  const [followUpTotal, setFollowUpTotal] = useState(0)
  const [followUpBusyId, setFollowUpBusyId] = useState<string | null>(null)
  const [newDealsThisMonth, setNewDealsThisMonth] = useState(0)
  const [targets, setTargets] = useState<TargetValues>(NO_TARGETS)
  const [targetsOpen, setTargetsOpen] = useState(false)

  useEffect(() => {
    if (stagesLoading) return
    let cancelled = false
    const wonStageIds = stages.filter((s) => s.is_won).map((s) => s.id)

    setLoading(true)
    Promise.all([
      fetchOpenDealValueByStage(),
      fetchPipelineForecast(),
      fetchDealsNeedingAttention(),
      fetchWonValueSince(wonStageIds, startOfMonthISO()),
      listOpenFollowUps(),
      fetchNewDealCountSince(startOfMonthISO()),
      fetchTargets(),
    ])
      .then(([values, forecastRows, attention, won, followUps, newDeals, targetValues]) => {
        if (cancelled) return
        setStageValues(values)
        setForecast(forecastRows)
        setNeedsAttention(attention)
        setWonThisMonth(won)
        setOpenFollowUps(followUps.rows)
        setFollowUpTotal(followUps.total)
        setNewDealsThisMonth(newDeals)
        setTargets(targetValues)
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

  const overdueCount = openFollowUps.filter((row) => isOverdue(row.due_at)).length

  // Drop it from the list straight away, restore it if the write fails.
  const handleCompleteFollowUp = async (row: OpenFollowUpRow) => {
    const previous = openFollowUps
    setFollowUpBusyId(row.id)
    setOpenFollowUps((current) => current.filter((r) => r.id !== row.id))
    setFollowUpTotal((current) => Math.max(0, current - 1))
    try {
      await setActivityCompleted(row.id, true, row.type)
    } catch (error) {
      setOpenFollowUps(previous)
      setFollowUpTotal((current) => current + 1)
      showToast(error instanceof Error ? error.message : 'Failed to update follow-up', 'error')
    } finally {
      setFollowUpBusyId(null)
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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <button
          type="button"
          onClick={() => setTargetsOpen(true)}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Set targets
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <TargetTile
          label="New deals this month"
          value={String(newDealsThisMonth)}
          target={String(targets.new_deals_per_month)}
          progress={newDealsThisMonth}
          targetRaw={targets.new_deals_per_month}
        />
        <TargetTile
          label="Deals won this month"
          value={String(wonThisMonth.count)}
          target={String(targets.won_deals_per_month)}
          progress={wonThisMonth.count}
          targetRaw={targets.won_deals_per_month}
        />
        <TargetTile
          label="Value won this month"
          value={formatCents(wonThisMonth.valueCents)}
          target={formatCents(targets.won_value_cents_per_month)}
          progress={wonThisMonth.valueCents}
          targetRaw={targets.won_value_cents_per_month}
        />
      </div>

      {/* "Won this month" used to live here; the Value won this month tile
          above is the same figure with a target attached. */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatTile label="Open pipeline value" value={formatCents(openValueCents)} />
        <StatTile label="Weighted forecast" value={formatCents(weightedForecastCents)} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense fallback={<SkeletonBlock className="h-72" />}>
          <StageValueChart stages={stages} totals={stageValues} />
        </Suspense>
        <Suspense fallback={<SkeletonBlock className="h-72" />}>
          <ForecastChart rows={forecast} />
        </Suspense>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold tracking-tight">Follow-ups due</h3>
            {overdueCount > 0 && (
              <span className="tabular text-xs font-medium" style={{ color: 'var(--color-stage-lost)' }}>
                {overdueCount} overdue
              </span>
            )}
          </div>
          <div className="mt-3">
            <FollowUpsList rows={openFollowUps} busyId={followUpBusyId} onComplete={handleCompleteFollowUp} />
          </div>
          {/* The list is capped. Showing the first eight of thirty without
              saying so is how a reminder quietly stops being one. */}
          {followUpTotal > openFollowUps.length && (
            <p className="mt-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
              Showing {openFollowUps.length} of {followUpTotal}.{' '}
              <Link to="/tasks" style={{ color: 'var(--color-brand-500)' }}>
                See them all
              </Link>
              .
            </p>
          )}
        </div>

        <NeedsAttentionList rows={needsAttention} />
      </div>

      <TargetsFormModal
        open={targetsOpen}
        targets={targets}
        onClose={() => setTargetsOpen(false)}
        onSaved={setTargets}
      />
    </div>
  )
}
