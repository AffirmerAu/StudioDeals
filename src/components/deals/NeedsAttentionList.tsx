import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import type { DealsNeedingAttentionRow } from '@/types/crm'

function issueLabels(row: DealsNeedingAttentionRow): string[] {
  const issues: string[] = []
  if (row.missing_value) issues.push('No value')
  if (row.missing_close_date) issues.push('No close date')
  if (row.close_date_passed) issues.push('Close date passed')
  return issues
}

export function NeedsAttentionList({ rows }: { rows: DealsNeedingAttentionRow[] }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
      <h3 className="text-sm font-semibold tracking-tight">Needs attention</h3>

      {rows.length === 0 ? (
        <div className="mt-2">
          <EmptyState title="Nothing needs attention" />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                to={`/pipeline?dealId=${row.id}`}
                className="block rounded-lg border px-3 py-2.5 text-sm transition-colors duration-150"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{row.title}</span>
                  <span className="shrink-0 text-xs" style={{ color: 'var(--text-subtle)' }}>
                    {row.stage}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                    {row.organisation_name}
                  </span>
                  <span className="shrink-0 text-xs" style={{ color: 'var(--color-stage-verbal)' }}>
                    {issueLabels(row).join(' · ')}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
