import type { TooltipContentProps } from 'recharts'
import { formatCents } from '@/lib/format'

export function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text)' }}
    >
      <p className="font-medium">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="tabular mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {formatCents(typeof entry.value === 'number' ? entry.value : 0)}
        </p>
      ))}
    </div>
  )
}
