interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)

  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border px-3 py-1.5 font-medium transition-colors duration-150 disabled:opacity-40"
          style={{ borderColor: 'var(--border)' }}
        >
          Previous
        </button>
        <span className="tabular px-1">
          {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          disabled={page + 1 >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border px-3 py-1.5 font-medium transition-colors duration-150 disabled:opacity-40"
          style={{ borderColor: 'var(--border)' }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
