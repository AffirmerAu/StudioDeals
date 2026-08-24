export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
        {title}
      </p>
      {hint && (
        <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}
