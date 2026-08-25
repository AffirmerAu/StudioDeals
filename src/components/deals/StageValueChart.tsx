import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { formatCentsCompact } from '@/lib/format'
import { stageColor } from '@/components/StageBadge'
import { ChartTooltip } from '@/components/deals/ChartTooltip'
import type { StageValueTotal } from '@/lib/dashboard'
import type { PipelineStageRow } from '@/types/crm'

interface StageValueChartProps {
  stages: PipelineStageRow[]
  totals: StageValueTotal[]
}

export function StageValueChart({ stages, totals }: StageValueChartProps) {
  const byStage = new Map(totals.map((t) => [t.stageId, t]))
  const data = stages.map((stage) => ({
    key: stage.key,
    label: stage.label,
    value: byStage.get(stage.id)?.valueCents ?? 0,
  }))

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
      <h3 className="text-sm font-semibold tracking-tight">Pipeline value by stage</h3>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
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
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={stageColor(entry.key)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
