import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCentsCompact } from '@/lib/format'
import { ChartTooltip } from '@/components/deals/ChartTooltip'
import { EmptyState } from '@/components/EmptyState'
import type { MonthPoint } from '@/lib/reports'

/** One series, so no legend — the heading names it. Bars rather than a line
 *  because each month is a discrete total, not a reading on a continuum. */
export function WonByMonthChart({ points }: { points: MonthPoint[] }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
      <h2 className="text-sm font-semibold tracking-tight">Value won by month</h2>

      {points.length === 0 ? (
        <div className="mt-2">
          <EmptyState title="Nothing won in this period" />
        </div>
      ) : (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} barCategoryGap="20%">
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-subtle)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
                // Every month is labelled while they fit; past that Recharts
                // thins them. Labelling all of a short run matters here — a
                // month with nothing won is a zero bar, and its label is the
                // only thing that shows the gap is real rather than skipped.
                interval={points.length > 8 ? 'preserveStartEnd' : 0}
              />
              <YAxis
                tick={{ fill: 'var(--text-subtle)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={formatCentsCompact}
              />
              <Tooltip content={ChartTooltip} cursor={{ fill: 'var(--surface-hover)' }} />
              <Bar
                dataKey="valueCents"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                fill="var(--color-stage-won)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
