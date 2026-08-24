export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: 'var(--surface-hover)' }}
    />
  )
}

export function SkeletonTableRows({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b" style={{ borderColor: 'var(--border)' }}>
          {Array.from({ length: cols }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <SkeletonBlock className="h-4 w-full max-w-32" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
