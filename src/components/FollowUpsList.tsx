import { ACTIVITY_TYPE_LABEL } from '@/lib/activities'
import { formatDateTime } from '@/lib/format'
import { EmptyState } from '@/components/EmptyState'
import type { OpenFollowUpRow } from '@/lib/activities'

interface FollowUpsListProps {
  rows: OpenFollowUpRow[]
  busyId: string | null
  onComplete: (row: OpenFollowUpRow) => void
}

export function FollowUpsList({ rows, busyId, onComplete }: FollowUpsListProps) {
  if (rows.length === 0) {
    return <EmptyState title="Nothing due" />
  }

  const now = new Date()

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        // due_at is never null here — listOpenFollowUps filters on it — but the
        // generated type can't know that.
        const overdue = row.due_at !== null && new Date(row.due_at) < now
        // Whichever record it hangs off; a follow-up always has at least one.
        const context = row.deal_title ?? row.contact_name ?? row.organisation_name

        return (
          <li
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <input
                type="checkbox"
                checked={false}
                disabled={busyId === row.id}
                onChange={() => onComplete(row)}
                aria-label={`Mark "${row.subject || ACTIVITY_TYPE_LABEL[row.type]}" done`}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.subject || ACTIVITY_TYPE_LABEL[row.type]}</p>
                {context && (
                  <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                    {context}
                  </p>
                )}
              </div>
            </div>

            <span
              className="tabular shrink-0 text-xs"
              style={{ color: overdue ? 'var(--color-stage-lost)' : 'var(--text-subtle)' }}
            >
              {overdue ? 'Overdue ' : ''}
              {row.due_at ? formatDateTime(row.due_at) : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
