import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCents } from '@/lib/format'
import { makeChartTooltip } from '@/components/deals/ChartTooltip'
import { EmptyState } from '@/components/EmptyState'
import type { LossReason } from '@/lib/reports'

const countTooltip = makeChartTooltip((value) => `${value} ${value === 1 ? 'deal' : 'deals'}`)

/**
 * Horizontal, because the reasons are phrases — "Poor Qualification" rotated
 * under a vertical bar is unreadable. Counts are direct-labelled since there
 * are only a handful of bars; the money sits in the list beside it rather than
 * on a second axis.
 */
export function LossReasonsChart({ reasons }: { reasons: LossReason[] }) {
  const total = reasons.reduce((sum, r) => sum + r.count, 0)

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
      <h2 className="text-sm font-semibold tracking-tight">Why deals are lost</h2>

      {reasons.length === 0 ? (
        <div className="mt-2">
          <EmptyState title="Nothing lost in this period" />
        </div>
      ) : (
        <>
          <div className="mt-4" style={{ height: Math.max(160, reasons.length * 38) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reasons} layout="vertical" margin={{ right: 28 }} barCategoryGap="20%">
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  // Ends at the largest count rather than Recharts' padded
                  // default, so the longest bar fills the width. In a ranking
                  // the bars are read against each other, not against a scale.
                  domain={[0, 'dataMax']}
                  tick={{ fill: 'var(--text-subtle)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="reason"
                  tick={{ fill: 'var(--text-subtle)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <Tooltip content={countTooltip} cursor={{ fill: 'var(--surface-hover)' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {reasons.map((reason) => (
                    <Cell
                      key={reason.reason}
                      // Losses nobody gave a reason for are not a reason —
                      // greyed so they read as a gap in the record.
                      fill={reason.unrecorded ? 'var(--text-subtle)' : 'var(--color-stage-lost)'}
                    />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    fill="var(--text-muted)"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* The same numbers as text: the value behind each reason, which
              would need a second axis on the chart, plus a readable fallback. */}
          <ul className="mt-4 space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            {reasons.map((reason) => (
              <li key={reason.reason} className="flex items-baseline justify-between gap-3 text-xs">
                <span style={{ color: reason.unrecorded ? 'var(--text-subtle)' : 'var(--text)' }}>
                  {reason.reason}
                </span>
                <span className="tabular shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {reason.count} · {formatCents(reason.valueCents)}
                  {total > 0 && ` · ${Math.round((reason.count / total) * 100)}%`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
