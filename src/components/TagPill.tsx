export function TagPill({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${label}`}
          className="-mr-0.5 rounded-lg px-0.5 leading-none transition-colors duration-150"
          style={{ color: 'var(--text-subtle)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-stage-lost)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
        >
          ×
        </button>
      )}
    </span>
  )
}
