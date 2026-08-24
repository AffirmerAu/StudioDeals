const STAGE_COLOR_VAR: Record<string, string> = {
  new: 'var(--color-stage-new)',
  meeting: 'var(--color-stage-meeting)',
  proposal: 'var(--color-stage-proposal)',
  verbal: 'var(--color-stage-verbal)',
  won: 'var(--color-stage-won)',
  lost: 'var(--color-stage-lost)',
}

export function stageColor(key: string): string {
  return STAGE_COLOR_VAR[key] ?? 'var(--text-muted)'
}

export function StageBadge({ stageKey, label }: { stageKey: string; label: string }) {
  const color = stageColor(stageKey)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium"
      style={{ color, background: 'var(--surface-hover)' }}
    >
      <span className="size-1.5 rounded-lg" style={{ background: color }} />
      {label}
    </span>
  )
}
