import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/lib/toast-context'
import { formatCents } from '@/lib/format'
import {
  fetchClosedDeals,
  formatPercent,
  lossReasons,
  periodStart,
  REPORT_PERIOD_LABEL,
  REPORT_PERIODS,
  summarise,
  withinPeriod,
  wonByMonth,
  type ClosedDeal,
  type ReportPeriod,
} from '@/lib/reports'
import { StatTile } from '@/components/StatTile'
import { SkeletonBlock } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { WonByMonthChart } from '@/components/reports/WonByMonthChart'
import { LossReasonsChart } from '@/components/reports/LossReasonsChart'

export function ReportsPage() {
  const { showToast } = useToast()
  const [period, setPeriod] = useState<ReportPeriod>('fy')
  const [deals, setDeals] = useState<ClosedDeal[]>([])
  const [loading, setLoading] = useState(true)

  // Fetched once; the period is applied here, so switching it is instant and
  // does not re-query. Closed deals are a few hundred rows.
  useEffect(() => {
    let cancelled = false
    fetchClosedDeals()
      .then((rows) => {
        if (!cancelled) setDeals(rows)
      })
      .catch((error: unknown) => {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Failed to load reports', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { summary, months, reasons, inPeriod } = useMemo(() => {
    const start = periodStart(period)
    const scoped = deals.filter((deal) => withinPeriod(deal, start))
    return {
      summary: summarise(scoped),
      months: wonByMonth(scoped, start),
      reasons: lossReasons(scoped),
      inPeriod: scoped.length,
    }
  }, [deals, period])

  return (
    <div className="p-8">
      <div className="max-w-5xl">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
          {!loading && (
            <span className="tabular text-sm" style={{ color: 'var(--text-muted)' }}>
              {inPeriod} closed {inPeriod === 1 ? 'deal' : 'deals'}
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {REPORT_PERIODS.map((option) => {
            const active = option === period
            return (
              <button
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
                aria-pressed={active}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
                style={{
                  borderColor: active ? 'var(--color-brand-500)' : 'var(--border)',
                  color: active ? 'var(--color-brand-500)' : 'var(--text-muted)',
                  background: active ? 'var(--surface-hover)' : 'var(--surface-raised)',
                }}
              >
                {REPORT_PERIOD_LABEL[option]}
              </button>
            )
          })}
        </div>

        {loading && (
          <div className="mt-5 space-y-4">
            <SkeletonBlock className="h-24 w-full" />
            <SkeletonBlock className="h-64 w-full" />
          </div>
        )}

        {!loading && deals.length === 0 && (
          <div className="mt-5">
            <EmptyState
              title="Nothing has closed yet"
              hint="Deals appear here once they reach Won or Lost."
            />
          </div>
        )}

        {!loading && deals.length > 0 && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile label="Deals won" value={String(summary.wonCount)} />
              <StatTile label="Value won" value={formatCents(summary.wonValueCents)} />
              {/* Won as a share of everything closed. Open deals are not in it:
                  a deal still in play has not been lost. */}
              <StatTile label="Win rate" value={formatPercent(summary.winRate)} />
              <StatTile
                label="Average won deal"
                value={summary.averageWonCents === null ? '—' : formatCents(summary.averageWonCents)}
              />
            </div>

            <div className="mt-4">
              <WonByMonthChart points={months} />
            </div>

            <div className="mt-4">
              <LossReasonsChart reasons={reasons} />
            </div>

            <p className="mt-4 text-xs" style={{ color: 'var(--text-subtle)' }}>
              A deal counts in the period it closed, by its won or lost date. Value is the deal's own
              value, not a weighted forecast.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
