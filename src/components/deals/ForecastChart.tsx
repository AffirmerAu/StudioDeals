import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCentsCompact, formatMonth } from '@/lib/format'
import { ChartTooltip } from '@/components/deals/ChartTooltip'
import type { PipelineForecastRow } from '@/types/crm'

export function ForecastChart({ rows }: { rows: PipelineForecastRow[] }) {
  const byMonth = new Map<string, number>()
  for (const row of rows) {
    byMonth.set(row.forecast_month, (byMonth.get(row.forecast_month) ?? 0) + row.weighted_value_cents)
  }
  const data = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month: formatMonth(month), value }))

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
      <h3 className="text-sm font-semibold tracking-tight">Weighted forecast by month</h3>
      {data.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--text-subtle)' }}>
          No open deals with an expected close date yet.
        </p>
      ) : (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="30%">
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: 'var(--text-subtle)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-subtle)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={formatCentsCompact}
              />
              <Tooltip content={ChartTooltip} cursor={{ fill: 'var(--surface-hover)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40} fill="var(--color-brand-500)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
