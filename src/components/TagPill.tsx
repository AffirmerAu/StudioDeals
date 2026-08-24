export function TagPill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
    >
      {label}
    </span>
  )
}
