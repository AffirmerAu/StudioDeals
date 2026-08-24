export interface SortState<TColumn extends string> {
  column: TColumn
  ascending: boolean
}

interface SortableHeaderProps<TColumn extends string> {
  column: TColumn
  label: string
  sort: SortState<TColumn>
  onSort: (column: TColumn) => void
  align?: 'left' | 'right'
}

export function SortableHeader<TColumn extends string>({
  column,
  label,
  sort,
  onSort,
  align = 'left',
}: SortableHeaderProps<TColumn>) {
  const active = sort.column === column

  return (
    <th className={`px-4 py-2.5 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 transition-colors duration-150"
        style={{ color: active ? 'var(--text)' : 'var(--text-muted)' }}
      >
        {label}
        <span className="w-3 text-[10px]" style={{ color: 'var(--color-brand-500)' }}>
          {active ? (sort.ascending ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  )
}
