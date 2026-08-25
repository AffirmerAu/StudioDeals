interface TargetTileProps {
  label: string
  /** The month-to-date figure, already formatted. */
  value: string
  /** The target, already formatted. Omitted when none is set. */
  target?: string
  /** Raw numbers drive the bar; formatting is the caller's business. */
  progress: number
  targetRaw: number
}

/**
 * A stat tile that carries a target: the big month-to-date number, the target
 * small beneath it, and a bar for the ratio. Progress is capped visually at
 * 100% but the percentage keeps counting, so beating a target still reads as
 * beating it.
 */
export function TargetTile({ label, value, target, progress, targetRaw }: TargetTileProps) {
  const hasTarget = targetRaw > 0
  const pct = hasTarget ? Math.round((progress / targetRaw) * 100) : 0
  const met = hasTarget && progress >= targetRaw
  const color = met ? 'var(--color-stage-won)' : 'var(--color-brand-500)'

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>

      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="tabular text-2xl font-semibold">{value}</p>
        {hasTarget && (
          <p className="tabular text-xs" style={{ color: met ? color : 'var(--text-subtle)' }}>
            {pct}%
          </p>
        )}
      </div>

      {hasTarget ? (
        <>
          <div
            className="mt-2 h-1 w-full overflow-hidden rounded-lg"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label} against target`}
            style={{ background: 'var(--surface-hover)' }}
          >
            <div
              className="h-full rounded-lg transition-all duration-150"
              style={{ width: `${Math.min(100, pct)}%`, background: color }}
            />
          </div>
          <p className="tabular mt-1.5 text-xs" style={{ color: 'var(--text-subtle)' }}>
            Target {target}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
          No target set
        </p>
      )}
    </div>
  )
}
