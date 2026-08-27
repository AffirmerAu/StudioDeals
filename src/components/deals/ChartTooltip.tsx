import type { TooltipContentProps } from 'recharts'
import { formatCents } from '@/lib/format'

/** Recharts wants a component, not an element, so a tooltip that formats
 *  something other than money is made by calling this with a formatter. */
export function makeChartTooltip(format: (value: number) => string) {
  return function CustomChartTooltip(props: TooltipContentProps) {
    return <ChartTooltip {...props} format={format} />
  }
}

export function ChartTooltip({
  active,
  payload,
  label,
  format = formatCents,
}: TooltipContentProps & { format?: (value: number) => string }) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text)' }}
    >
      <p className="font-medium">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="tabular mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {format(typeof entry.value === 'number' ? entry.value : 0)}
        </p>
      ))}
    </div>
  )
}
