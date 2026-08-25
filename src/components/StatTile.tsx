export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="tabular mt-1.5 text-2xl font-semibold">{value}</p>
    </div>
  )
}
